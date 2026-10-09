const express = require('express');
const router = express.Router();
const EvaluationForm = require('../models/EvaluationForm');
const DeliveryReceipt = require('../models/DeliveryReceipt');
const Book = require('../models/Book');
const StockTransaction = require('../models/StockTransaction');
const { protect, admin } = require('../middleware/auth');
const documentGenerator = require('../services/documentGenerator');

// Apply auth + admin to all routes
router.use(protect);
router.use(admin);

// Helper function to check for duplicate ISBNs
const checkDuplicateISBNs = (items) => {
  const isbnCounts = {};
  const duplicates = [];

  items.forEach((item, index) => {
    const isbn = item.isbn?.trim();
    if (isbn) {
      if (isbnCounts[isbn] === undefined) {
        isbnCounts[isbn] = { count: 1, indices: [index] };
      } else {
        isbnCounts[isbn].count++;
        isbnCounts[isbn].indices.push(index);
      }
    }
  });

  for (const [isbn, data] of Object.entries(isbnCounts)) {
    if (data.count > 1) {
      duplicates.push({
        isbn,
        count: data.count,
        indices: data.indices
      });
    }
  }

  return duplicates;
};

// ============================================
// ENTRY FORMS
// ============================================

// List EFs with search/filter
router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { efNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const [efs, total] = await Promise.all([
      EvaluationForm.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('createdBy', 'username')
        .populate('drRef', 'drNumber'),
      EvaluationForm.countDocuments(query)
    ]);

    res.json({ efs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create EF (draft)
router.post('/', async (req, res) => {
  try {
    const { efNumber, date, customerName, customerAddress, items, allowDuplicates } = req.body;

    if (!efNumber || !customerName || !items?.length) {
      return res.status(400).json({ message: 'efNumber, customerName, and items are required' });
    }

    const existing = await EvaluationForm.findOne({ efNumber });
    if (existing) {
      return res.status(400).json({ message: 'EF number already exists' });
    }

    // Check for duplicate ISBNs
    const duplicates = checkDuplicateISBNs(items);
    if (duplicates.length > 0 && !allowDuplicates) {
      return res.status(409).json({
        message: 'Duplicate ISBNs detected',
        code: 'DUPLICATE_ISBNS',
        duplicates: duplicates.map(d => ({
          isbn: d.isbn,
          count: d.count,
          lineNumbers: d.indices.map(i => i + 1)
        }))
      });
    }

    const ef = new EvaluationForm({
      efNumber,
      date: date ? new Date(date) : new Date(),
      customerName,
      customerAddress,
      items: items.map(item => ({
        ...item,
        amount: item.qty * item.unitPrice
      })),
      createdBy: req.user._id
    });

    await ef.save();
    res.status(201).json(ef);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get EF by ID
router.get('/:id', async (req, res) => {
  try {
    const ef = await EvaluationForm.findById(req.params.id).populate('createdBy', 'username').populate('drRef', 'drNumber');
    if (!ef) return res.status(404).json({ message: 'Evaluation Form not found' });
    res.json(ef);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update EF (draft only)
router.put('/:id', async (req, res) => {
  try {
    const ef = await EvaluationForm.findById(req.params.id);
    if (!ef) return res.status(404).json({ message: 'Evaluation Form not found' });
    if (ef.status !== 'draft') return res.status(400).json({ message: 'Cannot update issued EF' });

    const { efNumber, date, customerName, customerAddress, items, allowDuplicates } = req.body;

    if (efNumber && efNumber !== ef.efNumber) {
      const existing = await EvaluationForm.findOne({ efNumber });
      if (existing) return res.status(400).json({ message: 'EF number already exists' });
      ef.efNumber = efNumber;
    }

    if (date) ef.date = new Date(date);
    if (customerName) ef.customerName = customerName;
    if (customerAddress !== undefined) ef.customerAddress = customerAddress;
    if (items) {
      // Check for duplicate ISBNs
      const duplicates = checkDuplicateISBNs(items);
      if (duplicates.length > 0 && !allowDuplicates) {
        return res.status(409).json({
          message: 'Duplicate ISBNs detected',
          code: 'DUPLICATE_ISBNS',
          duplicates: duplicates.map(d => ({
            isbn: d.isbn,
            count: d.count,
            lineNumbers: d.indices.map(i => i + 1)
          }))
        });
      }

      ef.items = items.map(item => ({
        ...item,
        amount: item.qty * item.unitPrice
      }));
    }

    await ef.save();
    res.json(ef);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete EF (draft only)
router.delete('/:id', async (req, res) => {
  try {
    const ef = await EvaluationForm.findById(req.params.id);
    if (!ef) return res.status(404).json({ message: 'Evaluation Form not found' });
    if (ef.status !== 'draft') return res.status(400).json({ message: 'Cannot delete issued EF' });

    await ef.deleteOne();
    res.json({ message: 'Evaluation Form deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Issue EF - create linked DR draft (does NOT decrement stock)
router.post('/:id/issue', async (req, res) => {
  try {
    const ef = await EvaluationForm.findById(req.params.id);
    if (!ef) return res.status(404).json({ message: 'Evaluation Form not found' });
    if (ef.status === 'issued') return res.status(400).json({ message: 'EF already issued' });

    // Create linked DR draft from EF data
    const dr = new DeliveryReceipt({
      drNumber: `DR-${ef.efNumber.replace('EF-', '')}`, // Derive from EF number
      efRef: ef._id, // Reference back to EF
      date: new Date(),
      customerName: ef.customerName,
      customerAddress: ef.customerAddress,
      items: ef.items.map(item => ({ ...item.toObject() })),
      createdBy: req.user._id
    });
    await dr.save();

    // Mark EF as issued and link to DR
    ef.status = 'issued';
    ef.drRef = dr._id;
    await ef.save();

    res.json({ ef, dr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Export EF (PDF or Excel)
router.get('/:id/export', async (req, res) => {
  try {
    const { format = 'pdf' } = req.query;
    const ef = await EvaluationForm.findById(req.params.id);
    if (!ef) return res.status(404).json({ message: 'Evaluation Form not found' });

    // Use DR1 template for EF export
    const buffer = await documentGenerator.generate('DR1', ef.toObject(), format);

    const filename = `${ef.efNumber}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Export EF error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
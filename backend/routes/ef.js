const express = require('express');
const router = express.Router();
const EvaluationForm = require('../models/EvaluationForm');
const DeliveryReceipt = require('../models/DeliveryReceipt');
const SalesInvoice = require('../models/SalesInvoice');
const Book = require('../models/Book');
const StockTransaction = require('../models/StockTransaction');
const Customer = require('../models/Customer');
const { protect, admin } = require('../middleware/auth');
const documentGenerator = require('../services/documentGenerator');
const UserLog = require('../models/UserLog');

// Apply auth + admin to all routes
router.use(protect);
router.use(admin);

// Helper function to log user activities
const logUserActivity = async (userId, action, details = '', req = null) => {
  try {
    const logEntry = new UserLog({
      userId,
      action,
      details,
      ipAddress: req ? req.ip : null,
      userAgent: req ? req.get('User-Agent') : null,
    });
    await logEntry.save();
  } catch (error) {
    console.error('Failed to log user activity:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

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
        .populate('marketingExecutive', 'name'),
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
    const { efNumber, date, customerName, customerAddress, marketingExecutive, items, allowDuplicates } = req.body;

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
      date: date ? new Date(date) : null,
      customerName,
      customerAddress,
      marketingExecutive: marketingExecutive || null,
      items: items.map(item => ({
        ...item,
        amount: item.qty * item.unitPrice
      })),
      createdBy: req.user._id
    });

    await ef.save();
    // Populate marketingExecutive for response
    await ef.populate('marketingExecutive', 'name');
    await Customer.recordCustomer(ef.customerName, ef.customerAddress);
    await logUserActivity(req.user._id, 'CREATE_EF', `Created EF ${ef.efNumber} for ${ef.customerName} (${ef.items.length} items)`, req);
    res.status(201).json(ef);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get EF by ID
router.get('/:id', async (req, res) => {
  try {
    const ef = await EvaluationForm.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('marketingExecutive', 'name');
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

    const { efNumber, date, customerName, customerAddress, marketingExecutive, items, allowDuplicates } = req.body;

    if (efNumber && efNumber !== ef.efNumber) {
      const existing = await EvaluationForm.findOne({ efNumber });
      if (existing) return res.status(400).json({ message: 'EF number already exists' });
      ef.efNumber = efNumber;
    }

    if (date !== undefined) ef.date = date ? new Date(date) : null;
    if (customerName) ef.customerName = customerName;
    if (customerAddress !== undefined) ef.customerAddress = customerAddress;
    if (marketingExecutive !== undefined) ef.marketingExecutive = marketingExecutive || null;
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
    await ef.populate('marketingExecutive', 'name');
    await Customer.recordCustomer(ef.customerName, ef.customerAddress);
    await logUserActivity(req.user._id, 'UPDATE_EF', `Updated EF ${ef.efNumber}`, req);
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

    const { efNumber } = ef;
    await ef.deleteOne();
    await logUserActivity(req.user._id, 'DELETE_EF', `Deleted EF ${efNumber}`, req);
    res.json({ message: 'Evaluation Form deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Issue EF - create linked DR draft (does NOT decrement stock)
router.post('/:id/issue', async (req, res) => {
  try {
    // Atomic claim (guards double-click): flip draft -> issued BEFORE creating the linked DR
    const ef = await EvaluationForm.findOneAndUpdate(
      { _id: req.params.id, status: 'draft' },
      { status: 'issued' },
      { new: true }
    );
    if (!ef) return res.status(400).json({ message: 'EF already issued or cancelled' });

    try {
      // Create linked DR draft from EF data
      const dr = new DeliveryReceipt({
        drNumber: `DR-${ef.efNumber.replace('EF-', '')}`, // Derive from EF number
        efRef: ef._id, // Reference back to EF
        date: ef.date || null, // inherit the EF's date (or its absence)
        customerName: ef.customerName,
        customerAddress: ef.customerAddress,
        marketingExecutive: ef.marketingExecutive,
        items: ef.items.map(item => ({ ...item.toObject() })),
        createdBy: req.user._id
      });
      await dr.save();

      await logUserActivity(req.user._id, 'ISSUE_EF', `Issued EF ${ef.efNumber} for ${ef.customerName}`, req);

      res.json({ ef, dr });
    } catch (err) {
      // Roll back the EF claim so a retry can issue it again
      await EvaluationForm.findOneAndUpdate({ _id: ef._id, status: 'issued' }, { status: 'draft' });
      console.error('Issue EF failed, rolled back:', err);
      return res.status(500).json({ message: err.message });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel EF (issued only) - cascades to linked draft DR (and its draft SI). No stock impact:
// draft DRs never decremented stock, and an issued linked DR blocks the cancel.
router.post('/:id/cancel', async (req, res) => {
  try {
    const { cancelReason } = req.body;
    if (!cancelReason || !cancelReason.trim()) {
      return res.status(400).json({ message: 'cancelReason is required' });
    }

    // Load EF first so we can check the linked DR BEFORE mutating anything
    const existing = await EvaluationForm.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'EF not found or not in issued status' });
    if (existing.status !== 'issued') return res.status(400).json({ message: 'EF not found or not in issued status' });

    // Cascade check: linked DR must not be issued (it already moved stock)
    const linkedDR = await DeliveryReceipt.findOne({ efRef: existing._id });
    if (linkedDR && linkedDR.status === 'issued') {
      return res.status(400).json({ message: 'Linked DR is already issued - cancel the DR first' });
    }

    // Atomic claim (guards double-click): flip issued -> cancelled
    const ef = await EvaluationForm.findOneAndUpdate(
      { _id: req.params.id, status: 'issued' },
      { status: 'cancelled', cancelledAt: new Date(), cancelledBy: req.user._id, cancelReason: cancelReason.trim() },
      { new: true }
    );
    if (!ef) return res.status(404).json({ message: 'EF not found or not in issued status' });

    // Cancel the linked draft DR and its linked draft SI with the same reason
    let linkedSI = null;
    if (linkedDR && linkedDR.status === 'draft') {
      linkedSI = await SalesInvoice.findOne({ drRef: linkedDR._id });
      if (linkedSI && linkedSI.status === 'draft') {
        linkedSI.status = 'cancelled';
        linkedSI.cancelledAt = new Date();
        linkedSI.cancelledBy = req.user._id;
        linkedSI.cancelReason = cancelReason.trim();
        await linkedSI.save();
      } else {
        linkedSI = null;
      }

      linkedDR.status = 'cancelled';
      linkedDR.cancelledAt = new Date();
      linkedDR.cancelledBy = req.user._id;
      linkedDR.cancelReason = cancelReason.trim();
      await linkedDR.save();
    }

    await logUserActivity(req.user._id, 'CANCEL_EF', `Cancelled EF ${ef.efNumber} - Reason: ${cancelReason.trim()}`, req);

    res.json({ ef, dr: linkedDR, si: linkedSI });
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

    // Use EF template for EF export
    const buffer = await documentGenerator.generateEF(ef.toObject(), format);

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
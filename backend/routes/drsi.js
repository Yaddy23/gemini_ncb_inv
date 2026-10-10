const express = require('express');
const router = express.Router();
const DeliveryReceipt = require('../models/DeliveryReceipt');
const SalesInvoice = require('../models/SalesInvoice');
const Book = require('../models/Book');
const StockTransaction = require('../models/StockTransaction');
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

// ============================================
// DELIVERY RECEIPTS
// ============================================

// List DRs with search/filter
router.get('/dr', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { drNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const [drs, total] = await Promise.all([
      DeliveryReceipt.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('createdBy', 'username')
        .populate('efRef', 'efNumber')
        .populate('marketingExecutive', 'name'),
      DeliveryReceipt.countDocuments(query)
    ]);

    res.json({ drs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

// Create DR (draft)
router.post('/dr', async (req, res) => {
  try {
    const { drNumber, date, customerName, customerAddress, marketingExecutive, items, allowDuplicates } = req.body;

    if (!drNumber || !customerName || !items?.length) {
      return res.status(400).json({ message: 'drNumber, customerName, and items are required' });
    }

    const existing = await DeliveryReceipt.findOne({ drNumber });
    if (existing) {
      return res.status(400).json({ message: 'DR number already exists' });
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
          lineNumbers: d.indices.map(i => i + 1) // 1-based line numbers for user display
        }))
      });
    }

    const dr = new DeliveryReceipt({
      drNumber,
      date: date ? new Date(date) : new Date(),
      customerName,
      customerAddress,
      marketingExecutive: marketingExecutive || null,
      items: items.map(item => ({
        ...item,
        amount: item.qty * item.unitPrice
      })),
      createdBy: req.user._id
    });

    await dr.save();
    await dr.populate('marketingExecutive', 'name');
    res.status(201).json(dr);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get DR by ID
router.get('/dr/:id', async (req, res) => {
  try {
    const dr = await DeliveryReceipt.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('efRef', 'efNumber')
      .populate('marketingExecutive', 'name');
    if (!dr) return res.status(404).json({ message: 'Delivery Receipt not found' });
    res.json(dr);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update DR (draft only)
router.put('/dr/:id', async (req, res) => {
  try {
    const dr = await DeliveryReceipt.findById(req.params.id);
    if (!dr) return res.status(404).json({ message: 'Delivery Receipt not found' });
    if (dr.status !== 'draft') return res.status(400).json({ message: 'Cannot update issued DR' });

    const { drNumber, date, customerName, customerAddress, marketingExecutive, items, allowDuplicates } = req.body;

    if (drNumber && drNumber !== dr.drNumber) {
      const existing = await DeliveryReceipt.findOne({ drNumber });
      if (existing) return res.status(400).json({ message: 'DR number already exists' });
      dr.drNumber = drNumber;
    }

    if (date) dr.date = new Date(date);
    if (customerName) dr.customerName = customerName;
    if (customerAddress !== undefined) dr.customerAddress = customerAddress;
    if (marketingExecutive !== undefined) dr.marketingExecutive = marketingExecutive || null;
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

      dr.items = items.map(item => ({
        ...item,
        amount: item.qty * item.unitPrice
      }));
    }

    await dr.save();
    await dr.populate('marketingExecutive', 'name');
    res.json(dr);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete DR (draft only)
router.delete('/dr/:id', async (req, res) => {
  try {
    const dr = await DeliveryReceipt.findById(req.params.id);
    if (!dr) return res.status(404).json({ message: 'Delivery Receipt not found' });
    if (dr.status !== 'draft') return res.status(400).json({ message: 'Cannot delete issued DR' });

    await dr.deleteOne();
    res.json({ message: 'Delivery Receipt deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Issue DR - decrement stock & create linked SI draft
router.post('/dr/:id/issue', async (req, res) => {
  try {
    const dr = await DeliveryReceipt.findById(req.params.id);
    if (!dr) return res.status(404).json({ message: 'Delivery Receipt not found' });
    if (dr.status !== 'draft') return res.status(400).json({ message: 'DR already issued or cancelled' });

    // Decrement stock for each item
    for (const item of dr.items) {
      const book = await Book.findOne({ ISBN: item.isbn });
      if (!book) {
        return res.status(400).json({ message: `Book not found: ${item.isbn}` });
      }

      const newQty = book.QTY - item.qty;
      if (newQty < 0) {
        return res.status(400).json({ message: `Insufficient stock for ${item.isbn} (${book.TITLE}). Available: ${book.QTY}, Requested: ${item.qty}` });
      }

      const previousQty = book.QTY;
      book.QTY = newQty;
      await book.save();

      // Create stock transaction record
      await StockTransaction.create({
        ISBN: book.ISBN,
        action: 'OUTBOUND',
        qtyChanged: -item.qty,
        previousQty,
        newQty: book.QTY,
        performedBy: req.user._id,
      });
    }

    // Create linked SI draft
    const si = new SalesInvoice({
      siNumber: `SI-${dr.drNumber.replace('DR-', '')}`, // Derive from DR number
      drRef: dr._id,
      date: new Date(),
      customerName: dr.customerName,
      customerAddress: dr.customerAddress,
      poNumber: '',
      items: dr.items.map(item => ({ ...item.toObject() })),
      createdBy: req.user._id
    });
    await si.save();

    // Mark DR as issued
    dr.status = 'issued';
    await dr.save();

    res.json({ dr, si });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel DR (issued only) - cascades to linked draft SI and restores stock
router.post('/dr/:id/cancel', async (req, res) => {
  try {
    const { cancelReason } = req.body;
    if (!cancelReason || !cancelReason.trim()) {
      return res.status(400).json({ message: 'cancelReason is required' });
    }

    // Load DR first so we can check the linked SI BEFORE mutating anything
    const existing = await DeliveryReceipt.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'DR not found or not in issued status' });
    if (existing.status !== 'issued') return res.status(400).json({ message: 'DR not found or not in issued status' });

    // Cascade check: linked SI must not be issued
    const linkedSI = await SalesInvoice.findOne({ drRef: existing._id });
    if (linkedSI && linkedSI.status === 'issued') {
      return res.status(400).json({ message: 'Linked SI is already issued - cancel the SI first' });
    }

    // Atomic claim (guards double-click): flip issued -> cancelled
    const dr = await DeliveryReceipt.findOneAndUpdate(
      { _id: req.params.id, status: 'issued' },
      { status: 'cancelled', cancelledAt: new Date(), cancelledBy: req.user._id, cancelReason: cancelReason.trim() },
      { new: true }
    );
    if (!dr) return res.status(404).json({ message: 'DR not found or not in issued status' });

    // Cancel linked draft SI with the same reason
    if (linkedSI && linkedSI.status === 'draft') {
      linkedSI.status = 'cancelled';
      linkedSI.cancelledAt = new Date();
      linkedSI.cancelledBy = req.user._id;
      linkedSI.cancelReason = cancelReason.trim();
      await linkedSI.save();
    }

    // Restore stock for each item (reverse of issue)
    const missingBooks = [];
    for (const item of dr.items) {
      const book = await Book.findOne({ ISBN: item.isbn });
      if (book) {
        const previousQty = book.QTY;
        book.QTY += item.qty;
        await book.save();

        // Create stock transaction record
        await StockTransaction.create({
          ISBN: book.ISBN,
          action: 'INBOUND',
          qtyChanged: item.qty,
          previousQty,
          newQty: book.QTY,
          performedBy: req.user._id,
        });
      } else {
        missingBooks.push(item.isbn);
      }
    }

    const missingNote = missingBooks.length > 0 ? ` (WARNING: no book record found for ISBNs: ${missingBooks.join(', ')} - stock not restored for those items)` : '';
    await logUserActivity(req.user._id, 'CANCEL_DR', `Cancelled DR ${dr.drNumber} - Reason: ${cancelReason.trim()}${missingNote}`, req);

    res.json({ dr, si: linkedSI });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Export DR (PDF or Excel)
router.get('/dr/:id/export', async (req, res) => {
  try {
    const { format = 'pdf' } = req.query;
    const dr = await DeliveryReceipt.findById(req.params.id);
    if (!dr) return res.status(404).json({ message: 'Delivery Receipt not found' });

    const buffer = await documentGenerator.generate('DR1', dr.toObject(), format);

    const filename = `${dr.drNumber}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Export DR error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// SALES INVOICES
// ============================================

// List SIs
router.get('/si', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { siNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const [sis, total] = await Promise.all([
      SalesInvoice.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('createdBy', 'username')
        .populate('drRef', 'drNumber')
        .populate('marketingExecutive', 'name'),
      SalesInvoice.countDocuments(query)
    ]);

    res.json({ sis, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create SI (draft)
router.post('/si', async (req, res) => {
  try {
    const { siNumber, drRef, date, customerName, customerAddress, marketingExecutive, poNumber, items, discountPercentage, allowDuplicates } = req.body;

    if (!siNumber || !customerName || !items?.length) {
      return res.status(400).json({ message: 'siNumber, customerName, and items are required' });
    }

    const existing = await SalesInvoice.findOne({ siNumber });
    if (existing) return res.status(400).json({ message: 'SI number already exists' });

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

    const si = new SalesInvoice({
      siNumber,
      drRef: drRef || null,
      date: date ? new Date(date) : new Date(),
      customerName,
      customerAddress,
      marketingExecutive: marketingExecutive || null,
      poNumber,
      discountPercentage: discountPercentage || 0,
      items: items.map(item => ({
        ...item,
        amount: item.qty * item.unitPrice
      })),
      createdBy: req.user._id
    });

    await si.save();
    await si.populate('marketingExecutive', 'name');
    res.status(201).json(si);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get SI by ID
router.get('/si/:id', async (req, res) => {
  try {
    const si = await SalesInvoice.findById(req.params.id)
      .populate('createdBy', 'username')
      .populate('drRef', 'drNumber')
      .populate('marketingExecutive', 'name');
    if (!si) return res.status(404).json({ message: 'Sales Invoice not found' });
    res.json(si);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update SI (draft only)
router.put('/si/:id', async (req, res) => {
  try {
    const si = await SalesInvoice.findById(req.params.id);
    if (!si) return res.status(404).json({ message: 'Sales Invoice not found' });
    if (si.status !== 'draft') return res.status(400).json({ message: 'Cannot update issued SI' });

    const { siNumber, date, customerName, customerAddress, marketingExecutive, poNumber, items, discountPercentage, allowDuplicates } = req.body;

    if (siNumber && siNumber !== si.siNumber) {
      const existing = await SalesInvoice.findOne({ siNumber });
      if (existing) return res.status(400).json({ message: 'SI number already exists' });
      si.siNumber = siNumber;
    }

    if (date) si.date = new Date(date);
    if (customerName) si.customerName = customerName;
    if (customerAddress !== undefined) si.customerAddress = customerAddress;
    if (marketingExecutive !== undefined) si.marketingExecutive = marketingExecutive || null;
    if (poNumber !== undefined) si.poNumber = poNumber;
    if (discountPercentage !== undefined) si.discountPercentage = discountPercentage;
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

      si.items = items.map(item => ({
        ...item,
        amount: item.qty * item.unitPrice
      }));
    }

    await si.save();
    await si.populate('marketingExecutive', 'name');
    res.json(si);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete SI (draft only)
router.delete('/si/:id', async (req, res) => {
  try {
    const si = await SalesInvoice.findById(req.params.id);
    if (!si) return res.status(404).json({ message: 'Sales Invoice not found' });
    if (si.status !== 'draft') return res.status(400).json({ message: 'Cannot delete issued SI' });

    await si.deleteOne();
    res.json({ message: 'Sales Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Issue SI
router.post('/si/:id/issue', async (req, res) => {
  try {
    const si = await SalesInvoice.findById(req.params.id);
    if (!si) return res.status(404).json({ message: 'Sales Invoice not found' });
    if (si.status !== 'draft') return res.status(400).json({ message: 'SI already issued or cancelled' });

    si.status = 'issued';
    await si.save();

    res.json(si);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel SI (issued only) - no stock changes (SIs never moved stock)
router.post('/si/:id/cancel', async (req, res) => {
  try {
    const { cancelReason } = req.body;
    if (!cancelReason || !cancelReason.trim()) {
      return res.status(400).json({ message: 'cancelReason is required' });
    }

    // Atomic claim (guards double-click): flip issued -> cancelled
    const si = await SalesInvoice.findOneAndUpdate(
      { _id: req.params.id, status: 'issued' },
      { status: 'cancelled', cancelledAt: new Date(), cancelledBy: req.user._id, cancelReason: cancelReason.trim() },
      { new: true }
    );
    if (!si) return res.status(404).json({ message: 'SI not found or not in issued status' });

    await logUserActivity(req.user._id, 'CANCEL_SI', `Cancelled SI ${si.siNumber} - Reason: ${cancelReason.trim()}`, req);

    res.json(si);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Export SI (PDF or Excel)
router.get('/si/:id/export', async (req, res) => {
  try {
    const { format = 'pdf' } = req.query;
    const si = await SalesInvoice.findById(req.params.id);
    if (!si) return res.status(404).json({ message: 'Sales Invoice not found' });

    const buffer = await documentGenerator.generate('INV1', si.toObject(), format);

    const filename = `${si.siNumber}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Export SI error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
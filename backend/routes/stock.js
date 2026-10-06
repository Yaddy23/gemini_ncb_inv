const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const upload = require('../utils/fileUpload');
const {
  updateStock,
  bulkImportBooks,
  exportBooks,
  getTransactions,
  exportTransactions
} = require('../controllers/stockController');

// Stock update routes (accessible to both roles)
router.patch('/:isbn/stock', protect, updateStock);

// Bulk import and export (admin only)
router.post('/bulk-import', protect, admin, upload.single('file'), bulkImportBooks);
router.get('/export', protect, admin, exportBooks);

// Transaction log routes (admin only)
router.get('/transactions', protect, admin, getTransactions);
router.get('/transactions/export', protect, admin, exportTransactions);

module.exports = router;
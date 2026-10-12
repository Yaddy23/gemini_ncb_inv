const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const {
  getBooks,
  lookupBookByISBN,
  createBook,
  updateBook,
  deleteBook,
  getStats,
  getBookTransactions,
  getOutOfStockBooks,
} = require('../controllers/bookController');

// Public routes (protected but accessible to both roles)
router.get('/', protect, getBooks);
router.get('/stats', protect, getStats);
router.get('/out-of-stock', protect, getOutOfStockBooks);
router.get('/lookup/:isbn', protect, lookupBookByISBN);
router.get('/:isbn/transactions', protect, getBookTransactions);

// Admin only routes
router.post('/', protect, admin, createBook);
router.put('/:isbn', protect, admin, updateBook);
router.delete('/:isbn', protect, admin, deleteBook);

module.exports = router;
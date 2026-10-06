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
} = require('../controllers/bookController');

// Public routes (protected but accessible to both roles)
router.get('/', protect, getBooks);
router.get('/stats', protect, getStats);
router.get('/lookup/:isbn', protect, lookupBookByISBN);

// Admin only routes
router.post('/', protect, admin, createBook);
router.put('/:isbn', protect, admin, updateBook);
router.delete('/:isbn', protect, admin, deleteBook);

module.exports = router;
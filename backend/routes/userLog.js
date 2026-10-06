const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const {
  getUserLogs,
  exportUserLogs,
  getLogActions,
  getLogUsers
} = require('../controllers/userLogController');

// Admin only routes - User Logs
router.get('/', protect, admin, getUserLogs);
router.get('/export', protect, admin, exportUserLogs);
router.get('/actions', protect, admin, getLogActions);
router.get('/users', protect, admin, getLogUsers);

module.exports = router;
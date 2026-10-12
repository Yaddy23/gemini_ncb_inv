const UserLog = require('../models/UserLog');
const User = require('../models/User');

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

// Get user logs with filtering and pagination
// @desc    Get user logs
// @route   GET /api/user-logs
// @access  Private/Admin
const getUserLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;

    // Build query
    const query = {};

    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const logs = await UserLog.find(query)
      .populate('userId', 'username email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await UserLog.countDocuments(query);

    res.json({
      logs,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export user logs to Excel
// @desc    Export user logs
// @route   GET /api/user-logs/export
// @access  Private/Admin
const exportUserLogs = async (req, res) => {
  try {
    const { action, userId, startDate, endDate } = req.query;

    // Build query (same as getUserLogs but without pagination)
    const query = {};

    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Fetch logs
    const logs = await UserLog.find(query)
      .populate('userId', 'username email role')
      .sort({ createdAt: -1 });

    // If no logs found
    if (logs.length === 0) {
      return res.status(404).json({ message: 'No logs found to export' });
    }

    // Convert to Excel format
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('User Logs');

    // Define columns
    worksheet.columns = [
      { header: 'ID', key: '_id', width: 25 },
      { header: 'User ID', key: 'userId._id', width: 25 },
      { header: 'Username', key: 'userId.username', width: 20 },
      { header: 'Email', key: 'userId.email', width: 30 },
      { header: 'Role', key: 'userId.role', width: 15 },
      { header: 'Action', key: 'action', width: 20 },
      { header: 'Details', key: 'details', width: 50 },
      { header: 'IP Address', key: 'ipAddress', width: 20 },
      { header: 'User Agent', key: 'userAgent', width: 50 },
      { header: 'Timestamp', key: 'timestamp', width: 25 }
    ];

    // Add rows
    logs.forEach(log => {
      worksheet.addRow({
        _id: log._id,
        'userId._id': log.userId._id,
        'userId.username': log.userId.username,
        'userId.email': log.userId.email,
        'userId.role': log.userId.role,
        action: log.action,
        details: log.details || '',
        ipAddress: log.ipAddress || '',
        userAgent: log.userAgent || '',
        timestamp: log.createdAt.toLocaleString()
      });
    });

    // Set response headers for Excel file
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=user-logs-' + new Date().toISOString().slice(0,10) + '.xlsx'
    );

    // Log export action
    await logUserActivity(req.user._id, 'EXPORT_LOGS', `Exported ${logs.length} user logs`, req);

    // Export to Excel
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get unique actions for filter dropdown
// @desc    Get log actions
// @route   GET /api/user-logs/actions
// @access  Private/Admin
const getLogActions = async (req, res) => {
  try {
    const actions = await UserLog.distinct('action');
    res.json({ actions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get unique users for filter dropdown
// @desc    Get log users
// @route   GET /api/user-logs/users
// @access  Private/Admin
const getLogUsers = async (req, res) => {
  try {
    const users = await UserLog.find().distinct('userId');
    const userDetails = await User.find({ '_id': { $in: users } })
      .select('_id username email role');
    res.json({ users: userDetails });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUserLogs,
  exportUserLogs,
  getLogActions,
  getLogUsers
};
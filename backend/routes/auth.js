const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const {
  loginUser,
  getUserProfile,
  registerUser,
  changePassword,
  updateProfile,
  getAllUsers,
  updateUser,
  deleteUser,
  logoutUser,
} = require('../controllers/authController');

// Public routes
router.post('/login', loginUser);

// Protected routes
router.get('/me', protect, getUserProfile);
router.post('/register', protect, admin, registerUser);
router.put('/change-password', protect, changePassword);
router.put('/profile', protect, updateProfile);
router.post('/logout', protect, logoutUser);

// Admin only routes - User Management
router.get('/users', protect, admin, getAllUsers);
router.put('/users/:id', protect, admin, updateUser);
router.delete('/users/:id', protect, admin, deleteUser);

module.exports = router;
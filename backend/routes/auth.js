const express = require('express');
const rateLimit = require('express-rate-limit');
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

// Login rate limiter: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts from this IP. Try again in 15 minutes.' }
});

// Public routes
router.post('/login', loginLimiter, loginUser);

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
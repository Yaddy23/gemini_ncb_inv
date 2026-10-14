const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const { getReservations, expireStale } = require('../controllers/reservationController');

router.use(protect);

router.get('/', admin, getReservations);
router.post('/expire-stale', admin, expireStale);

module.exports = router;

const DeliveryReceipt = require('../models/DeliveryReceipt');
const Book = require('../models/Book');
const StockTransaction = require('../models/StockTransaction');
const UserLog = require('../models/UserLog');

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

// Resolve the staleness threshold from env: 0 disables staleness entirely
const getExpiryDays = () => {
  const parsed = parseInt(process.env.RESERVATION_EXPIRY_DAYS, 10);
  if (!Number.isNaN(parsed) && parsed === 0) return null; // disabled
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  return 14; // default
};

const ageDaysOf = (createdAt) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);

// Fetch draft standalone DRs and map to one hold per DR
const getStaleCandidateHolds = async () => {
  const drs = await DeliveryReceipt.find({ status: 'draft', efRef: null })
    .populate('createdBy', 'username')
    .sort({ createdAt: 1 });

  return drs.map(dr => ({
    dr,
    hold: {
      drId: dr._id,
      drNumber: dr.drNumber,
      customerName: dr.customerName,
      customerAddress: dr.customerAddress,
      reservedBy: dr.createdBy?.username || null,
      createdAt: dr.createdAt,
      ageDays: ageDaysOf(dr.createdAt),
      totalQty: dr.items.reduce((sum, item) => sum + (item.qty || 0), 0),
      items: dr.items.map(({ isbn, title, qty }) => ({ isbn, title, qty }))
    }
  }));
};

// @desc    Get all reservations (draft standalone DRs, one hold per DR)
// @route   GET /api/stock/reservations
// @access  Private
const getReservations = async (req, res) => {
  try {
    const expiryDays = getExpiryDays();
    const entries = await getStaleCandidateHolds();

    const holds = entries.map(({ hold }) => ({
      ...hold,
      stale: expiryDays !== null && hold.ageDays >= expiryDays
    }));

    const summary = {
      totalHolds: holds.length,
      totalUnits: holds.reduce((sum, hold) => sum + hold.totalQty, 0),
      staleCount: holds.filter(hold => hold.stale).length
    };

    res.json({ holds, summary, expiryDays });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Expire stale reservations (release reserved stock and delete draft DRs)
// @route   POST /api/stock/reservations/expire-stale
// @access  Private/Admin
const expireStale = async (req, res) => {
  try {
    const expiryDays = getExpiryDays();

    if (expiryDays === null) {
      return res.status(400).json({ message: 'Reservation expiry is disabled (RESERVATION_EXPIRY_DAYS=0)' });
    }

    const entries = await getStaleCandidateHolds();
    const staleEntries = entries.filter(({ hold }) => hold.ageDays >= expiryDays);

    const released = [];
    const failed = [];

    for (const { dr, hold } of staleEntries) {
      try {
        // Re-fetch fresh state: the DR may have been issued, linked to an EF
        // or deleted since the candidate list was built (mirrors DELETE /dr/:id,
        // which re-reads the document before acting).
        const fresh = await DeliveryReceipt.findById(dr._id);
        if (!fresh || fresh.status !== 'draft' || fresh.efRef) continue;

        // Release reservations for each item, mirroring DELETE /dr/:id.
        // A single bad item fails only this DR; the run continues.
        let itemError = null;
        for (const item of fresh.items) {
          const book = await Book.findOne({ ISBN: item.isbn });
          if (!book) {
            itemError = `Book not found: ${item.isbn}`;
            break;
          }
          if (book.reservedQty < item.qty) {
            itemError = `Insufficient reservation to release for ${item.isbn}`;
            break;
          }
          book.reservedQty -= item.qty;
          await book.save();
          // Optional: create RELEASE StockTransaction for audit trail
          await StockTransaction.create({
            ISBN: book.ISBN,
            action: 'RELEASE',
            qtyChanged: 0,
            previousQty: book.QTY, // QTY unchanged by reservation release
            newQty: book.QTY,
            performedBy: req.user._id
          });
        }

        // If any item failed, the DR is left intact for manual handling
        if (itemError) {
          failed.push({ drId: hold.drId, drNumber: hold.drNumber, error: itemError });
          continue;
        }

        await fresh.deleteOne();
        released.push({ drId: hold.drId, drNumber: hold.drNumber });
      } catch (error) {
        failed.push({ drId: hold.drId, drNumber: hold.drNumber, error: error.message });
      }
    }

    const releasedList = released.map(r => r.drNumber).join(', ');
    const failedList = failed.map(f => f.drNumber).join(', ');
    let details = `Expired ${released.length} stale reservation(s)${releasedList ? `: ${releasedList}` : ''}`;
    if (failed.length) details += ` (${failed.length} failed: ${failedList})`;
    await logUserActivity(req.user._id, 'EXPIRE_RESERVATIONS', details, req);

    res.json({ released: released.length, drs: released, failed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove a single book (line item) from a reservation, releasing its reservedQty.
//          If it is the last item, the whole draft DR (the hold) is deleted.
// @route   POST /api/stock/reservations/release-item
// @access  Private
const releaseItem = async (req, res) => {
  try {
    const { drId, isbn, lineIndex } = req.body;
    if (!drId || !isbn) {
      return res.status(400).json({ message: 'drId and isbn are required' });
    }

    // Re-fetch fresh state: the DR may have been issued/linked/deleted since
    // the list was loaded (same race guard as expire-stale).
    const dr = await DeliveryReceipt.findById(drId);
    if (!dr) return res.status(404).json({ message: 'Delivery Receipt not found' });
    if (dr.status !== 'draft') return res.status(400).json({ message: 'DR is no longer a draft' });
    if (dr.efRef) return res.status(400).json({ message: 'DR is linked to an Evaluation Form and holds no reservation' });

    // Prefer the exact line the user clicked (disambiguates duplicate-ISBN lines,
    // possible via the allow-duplicates path). If the document changed since the
    // list was rendered, refuse rather than silently removing the wrong line.
    let itemIndex = -1;
    if (Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < dr.items.length) {
      if (dr.items[lineIndex].isbn !== isbn) {
        return res.status(409).json({ message: 'Reservation changed since it was loaded — please refresh and try again' });
      }
      itemIndex = lineIndex;
    } else {
      itemIndex = dr.items.findIndex(it => it.isbn === isbn);
    }
    if (itemIndex === -1) {
      return res.status(404).json({ message: `ISBN ${isbn} is not on this reservation` });
    }
    const item = dr.items[itemIndex];

    // Release this item's reservation (mirrors DELETE /dr/:id)
    const book = await Book.findOne({ ISBN: item.isbn });
    if (!book) return res.status(400).json({ message: `Book not found: ${item.isbn}` });
    if (book.reservedQty < item.qty) {
      return res.status(400).json({ message: `Insufficient reservation to release for ${item.isbn}` });
    }
    book.reservedQty -= item.qty;
    await book.save();
    await StockTransaction.create({
      ISBN: book.ISBN,
      action: 'RELEASE',
      qtyChanged: 0,
      previousQty: book.QTY, // QTY unchanged by reservation release
      newQty: book.QTY,
      performedBy: req.user._id
    });

    const wasLastItem = dr.items.length === 1;

    if (wasLastItem) {
      const { drNumber } = dr;
      await dr.deleteOne();
      await logUserActivity(req.user._id, 'UPDATE_DR', `Released ${item.qty} unit(s) of ${item.isbn} from draft DR ${drNumber}; DR deleted (no items left)`, req);
      return res.json({ message: 'Reservation released — DR deleted (no items left)', deleted: true, releasedQty: item.qty, drNumber });
    }

    dr.items.splice(itemIndex, 1);
    await dr.save(); // pre-save hook recomputes subtotal/totalAmount/updatedAt
    await logUserActivity(req.user._id, 'UPDATE_DR', `Released ${item.qty} unit(s) of ${item.isbn} from draft DR ${dr.drNumber} (reservation item removed)`, req);

    res.json({ message: `${item.qty} unit(s) of ${item.isbn} returned to available stock`, deleted: false, releasedQty: item.qty, remainingItems: dr.items.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getReservations,
  expireStale,
  releaseItem
};

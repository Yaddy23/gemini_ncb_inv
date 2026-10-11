const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date },
}, {
  timestamps: true
});

// Case-insensitive unique name - customer names arrive as free text from
// documents, so "ACME Corp" and "Acme Corp" must be the same customer
customerSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
customerSchema.index({ isActive: 1 });

const NAME_COLLATION = { locale: 'en', strength: 2 };

// Records (or refreshes) a customer from a document's free-text name/address
// so the directory grows as documents are created. Never throws - a failure to
// record must not break the document operation it accompanies.
customerSchema.statics.recordCustomer = async function (name, address) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) return null;

  const trimmedAddress = (address || '').trim();

  try {
    return await this.findOneAndUpdate(
      { name: trimmedName },
      {
        $setOnInsert: { name: trimmedName },
        $set: {
          lastUsedAt: new Date(),
          // Latest address used on a document wins - it is the one the user
          // most recently confirmed as correct
          ...(trimmedAddress ? { address: trimmedAddress } : {})
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, collation: NAME_COLLATION }
    );
  } catch (error) {
    console.error('Failed to record customer:', error);
    return null;
  }
};

// Case-insensitive lookup used by the routes for duplicate checks
customerSchema.statics.findByName = function (name) {
  return this.findOne({ name: (name || '').trim() }).collation(NAME_COLLATION);
};

module.exports = mongoose.model('Customer', customerSchema);

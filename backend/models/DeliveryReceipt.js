const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  isbn: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 }
}, { _id: false });

const deliveryReceiptSchema = new mongoose.Schema({
  drNumber: { type: String, required: true, unique: true, trim: true },
  date: { type: Date, required: true, default: Date.now },
  customerName: { type: String, required: true, trim: true },
  customerAddress: { type: String, trim: true },
  marketingExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketingExecutive' },
  items: { type: [lineItemSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'issued', 'cancelled'], default: 'draft' },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String, trim: true },
  efRef: { type: mongoose.Schema.Types.ObjectId, ref: 'EvaluationForm' }, // Reference to source EF
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

deliveryReceiptSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
  this.totalAmount = this.subtotal; // No VAT
  next();
});

module.exports = mongoose.model('DeliveryReceipt', deliveryReceiptSchema);
import mongoose from 'mongoose'

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Please provide an invoice number'],
    trim: true
  },
  supplierGstin: {
    type: String,
    required: [true, 'Please provide the Supplier GSTIN'],
    trim: true,
    uppercase: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  date: {
    type: Date,
    default: Date.now
  },
  items: [{
    medicineName: { type: String, required: true },
    batchNumber: { type: String, required: true },
    quantity: { type: Number, default: 1 }
  }],
  verificationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  flags: [{
    type: String // e.g., 'INVALID_GSTIN', 'SUPPLIER_BLACKLISTED', 'BATCH_MISMATCH'
  }],
  invoiceImageUrl: {
    type: String
  }
}, {
  timestamps: true
})

invoiceSchema.index({ invoiceNumber: 1, supplierGstin: 1 })

export default mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema)

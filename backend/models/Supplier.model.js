import mongoose from 'mongoose'

const supplierSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: [true, 'Please provide the business name'],
    trim: true
  },
  gstin: {
    type: String,
    required: [true, 'Please provide the GSTIN'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please provide a valid GSTIN format']
  },
  drugLicenseNumber: {
    type: String,
    required: [true, 'Please provide the Drug License Number'],
    trim: true
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true, default: 'Lucknow' },
    state: { type: String, required: true, default: 'Uttar Pradesh' },
    pincode: { type: String, required: true }
  },
  isAuthorized: {
    type: Boolean,
    default: true
  },
  blacklisted: {
    type: Boolean,
    default: false
  },
  blacklistedReason: {
    type: String
  }
}, {
  timestamps: true
})

// Index for fast lookups by GSTIN
supplierSchema.index({ gstin: 1 })

export default mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema)

import Supplier from '../models/Supplier.model.js'

export const isValidUPGstin = (gstin) => {
  if (!gstin) return false
  // UP State Code is 09. Format: 2 digits + 5 letters + 4 digits + 1 letter + 1 char + Z + 1 char
  const regex = /^09[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i
  return regex.test(gstin)
}

export const verifySupplier = async (gstin) => {
  if (!gstin) {
    return { valid: false, reason: 'GSTIN missing from invoice' }
  }

  if (!isValidUPGstin(gstin)) {
    return { valid: false, reason: 'Invalid GSTIN format or not a UP registered entity (09)' }
  }

  const supplier = await Supplier.findOne({ gstin: gstin.toUpperCase() })

  if (!supplier) {
    return { valid: false, reason: 'Supplier not found in verified database' }
  }

  if (supplier.blacklisted) {
    return { valid: false, reason: `Supplier is blacklisted: ${supplier.blacklistedReason}` }
  }

  if (!supplier.isAuthorized) {
    return { valid: false, reason: 'Supplier is registered but currently unauthorized' }
  }

  return { valid: true, supplier }
}

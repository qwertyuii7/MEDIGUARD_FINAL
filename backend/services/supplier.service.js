import Supplier from '../models/Supplier.model.js'
import axios from 'axios'

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

  let gstGovtVerified = false;
  let govtDetails = null;

  try {
    const res = await axios.get(
      `https://sheet.gstincheck.co.in/check/${process.env.GSTIN_API_KEY}/${gstin}`
    );
    
    // The API might return { flag: true, data: { ... } } or just the data directly
    const resultData = res.data?.data && Object.keys(res.data.data).length > 0 
      ? res.data.data 
      : res.data;

    if (resultData && (resultData.legal_name || resultData.lgnm)) {
      gstGovtVerified = true;
      govtDetails = {
        legalName: resultData.legal_name || resultData.lgnm || 'Govt Verified Entity',
        status: resultData.status || resultData.sts || 'Active',
        stateCode: resultData.state_code || '09'
      };
    }
  } catch (error) {
    console.warn('[SupplierService] GSTIN API check failed:', error.message);
  }

  const supplier = await Supplier.findOne({ gstin: gstin.toUpperCase() })

  if (!supplier) {
    return { 
      valid: false, 
      reason: 'Supplier not found in verified database',
      gstGovtVerified,
      govtDetails
    }
  }

  if (supplier.blacklisted) {
    return { 
      valid: false, 
      reason: `Supplier is blacklisted: ${supplier.blacklistedReason}`,
      gstGovtVerified,
      govtDetails
    }
  }

  if (!supplier.isAuthorized) {
    return { 
      valid: false, 
      reason: 'Supplier is registered but currently unauthorized',
      gstGovtVerified,
      govtDetails
    }
  }

  return { 
    valid: true, 
    supplier,
    gstGovtVerified,
    govtDetails
  }
}

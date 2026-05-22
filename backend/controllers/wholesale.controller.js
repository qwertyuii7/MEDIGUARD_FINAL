import Invoice from '../models/Invoice.model.js'
import Supplier from '../models/Supplier.model.js'
import { verifySupplier } from '../services/supplier.service.js'
import { analyzeInvoice, analyzeImage } from '../services/groq.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const verifyWholesalePurchase = asyncHandler(async (req, res) => {
  console.log('\n========== B2B WHOLESALE VERIFICATION REQUEST ==========')
  const { manualGstin, manualInvoiceNumber, manualBatchNumber } = req.body
  console.log('[B2B] Manual inputs:', { manualGstin, manualInvoiceNumber, manualBatchNumber })
  
  const invoiceFile = req.files?.['invoiceImage']?.[0]
  const medicineFile = req.files?.['medicineImage']?.[0]
  console.log('[B2B] Invoice file:', invoiceFile ? { path: invoiceFile.path, mimetype: invoiceFile.mimetype, size: invoiceFile.size } : 'NONE')
  console.log('[B2B] Medicine file:', medicineFile ? { path: medicineFile.path, mimetype: medicineFile.mimetype, size: medicineFile.size } : 'NONE')

  let gstin = manualGstin
  let invoiceNumber = manualInvoiceNumber
  let invoiceBatches = []
  
  const flags = []
  let verificationScore = 0

  // 1. Process Invoice via Vision or fallback
  if (invoiceFile) {
    const invoiceUrl = invoiceFile.path
    console.log('[B2B] Step 1: Calling analyzeInvoice with path:', invoiceUrl)
    try {
      const extracted = await analyzeInvoice(invoiceUrl)
      console.log('[B2B] AI Extraction Result:', JSON.stringify(extracted, null, 2))
      if (extracted.gstin) gstin = extracted.gstin
      if (extracted.invoiceNumber) invoiceNumber = extracted.invoiceNumber
      if (extracted.batches && extracted.batches.length > 0) invoiceBatches = extracted.batches
    } catch (err) {
      console.error('[B2B] ❌ Invoice vision extraction FAILED:', err.message)
      console.error('[B2B] Full error:', err.response?.data || err)
      flags.push('VISION_EXTRACTION_FAILED')
    }
  } else {
    console.log('[B2B] No invoice file uploaded, using manual inputs only')
  }

  // 2. Supplier Verification (40 pts)
  const supplierCheck = await verifySupplier(gstin)
  
  if (supplierCheck.valid) {
    verificationScore += 40
  } else {
    flags.push(supplierCheck.reason)
    if (supplierCheck.reason.includes('blacklisted')) {
      verificationScore = 0 // Immediate drop to 0
    } else if (isValidUPGstinFormat(gstin)) {
      verificationScore += 10 // Valid format but not in DB
    }
  }

  // Helper for format check
  function isValidUPGstinFormat(gst) {
    return /^09[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(gst || '')
  }

  // 3. Invoice Integrity (20 pts)
  if (invoiceNumber && invoiceNumber !== 'BLANK') verificationScore += 10
  if (invoiceBatches.length > 0) verificationScore += 10
  
  if (!invoiceNumber) flags.push('MISSING_INVOICE_NUMBER')

  // 4. Batch Cross-check (40 pts)
  let extractedMedicineBatch = manualBatchNumber
  let medicineAnalysis = null

  if (medicineFile) {
    try {
      medicineAnalysis = await analyzeImage(medicineFile.path)
      if (medicineAnalysis.fields?.batchNumber) {
        extractedMedicineBatch = medicineAnalysis.fields.batchNumber
      }
    } catch (err) {
      console.error('Medicine vision extraction failed:', err)
      flags.push('MEDICINE_VISION_FAILED')
    }
  }

  if (extractedMedicineBatch && extractedMedicineBatch !== 'BLANK') {
    // Check if the physical batch matches ANY batch on the invoice
    // Fuzzy match or exact match
    const matchFound = invoiceBatches.some(b => 
      b.toUpperCase().includes(extractedMedicineBatch.toUpperCase()) || 
      extractedMedicineBatch.toUpperCase().includes(b.toUpperCase())
    )

    if (matchFound || invoiceBatches.length === 0) { // If no invoice batches extracted, we can't definitively say mismatch
      if (matchFound) verificationScore += 20
    } else {
      flags.push('BATCH_MISMATCH')
    }

    // Check CDSCO safety (mocked via the analyzeImage DB check if we had it, or we just trust the analysis)
    if (medicineAnalysis && medicineAnalysis.status !== 'FAKE') {
      verificationScore += 20
    } else if (medicineAnalysis && medicineAnalysis.status === 'FAKE') {
      flags.push('MEDICINE_BATCH_RECALLED')
      verificationScore = 0 // critical failure
    } else if (!medicineFile) {
      verificationScore += 20 // Manual entry assumes not fake until checked
    }
  } else {
    flags.push('NO_PHYSICAL_BATCH_FOUND')
  }

  // Save the invoice record
  const newInvoice = await Invoice.create({
    invoiceNumber: invoiceNumber || 'UNKNOWN',
    supplierGstin: gstin || 'UNKNOWN',
    buyerId: req.user?._id, // if authenticated
    items: invoiceBatches.map(b => ({ medicineName: 'Extracted', batchNumber: b })),
    verificationScore,
    flags,
    invoiceImageUrl: invoiceFile ? invoiceFile.path : null
  })

  res.status(200).json({
    success: true,
    data: {
      invoiceId: newInvoice._id,
      score: verificationScore,
      gstin: gstin,
      supplierDetails: supplierCheck.valid ? supplierCheck.supplier : null,
      flags,
      extractedBatches: invoiceBatches,
      physicalBatch: extractedMedicineBatch,
      medicineAnalysis: medicineAnalysis ? medicineAnalysis.text : null
    }
  })
})

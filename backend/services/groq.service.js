import axios from 'axios'
import fs from 'fs'
import path from 'path'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// ─── COMBINED LAYER 1 & 2: OCR + QUALITY ────────────────────────
const COMBINED_OCR_QUALITY_PROMPT = `You are a pharmaceutical packaging inspector. Analyze this medicine packaging image.

TASK 1: Extract all text (OCR).
TASK 2: Evaluate packaging quality.

RESPOND IN THIS EXACT FORMAT:

BRAND_NAME: [largest text on package]
GENERIC_NAME: [chemical/generic name if visible]  
MANUFACTURER: [company name exactly as printed]
MRP: [price with Rs/₹ symbol if visible, else BLANK]
BATCH_NO: [lot/batch number if visible, else BLANK]
EXPIRY: [expiry date if visible, else BLANK]
MFG_DATE: [manufacturing date if visible, else BLANK]
DRUG_LICENSE: [DL number if visible, else BLANK]
ADDRESS: [manufacturer address if visible, else BLANK]
RX_SYMBOL: [YES if Rx visible, NO if not visible]
SCHEDULE: [H/H1/G/X if visible, else BLANK]
BARCODE: [YES if barcode visible, NO if not]
HOLOGRAM: [YES if security hologram visible, NO if not]

PRINT_QUALITY: [GOOD/POOR/CANNOT_ASSESS]
COLOR_CONSISTENCY: [GOOD/POOR/CANNOT_ASSESS]
FONT_CONSISTENCY: [GOOD/POOR/CANNOT_ASSESS]
MANDATORY_FIELDS_COMPLETE: [YES/NO/PARTIAL]
ALIGNMENT: [GOOD/POOR/CANNOT_ASSESS]
SECURITY_FEATURES: [PRESENT/ABSENT/CANNOT_ASSESS]
TAMPER_SIGNS: [NONE/SUSPICIOUS/CANNOT_ASSESS]

MISSING_MANDATORY_FIELDS: [list fields missing, or NONE]
VISUAL_CONCERNS: [list specific concerns, or NONE]
OVERALL_PACKAGING_GRADE: [A/B/C/F]
PACKAGING_VERDICT: [PROFESSIONAL/HAS_CONCERNS/POOR_QUALITY/CANNOT_ASSESS]

CRITICAL: 
- Read text EXACTLY as printed.
- If text is missing or unreadable, write BLANK.
- Grade A is professional pharmaceutical standard. Grade F has obvious errors.`

// ─── LAYER 3 PROMPT: Final safety assessment ────────────────────
const buildLayer3Prompt = (ocrAndQualityData, batchStatus) => `You are a medicine safety advisor for Indian patients.

You have received these analysis results:

PACKAGING ANALYSIS (OCR + QUALITY):
${ocrAndQualityData}

BATCH VERIFICATION RESULT:
${batchStatus}

Based on ALL sources above, provide a final patient safety assessment.

IMPORTANT RULES:
- DO NOT say medicine is FAKE unless batch is officially recalled OR multiple serious packaging concerns exist
- DO NOT say medicine is GENUINE with high confidence based on image alone
- Be HONEST about what you can and cannot determine from packaging

RESPOND IN THIS FORMAT:

FINAL_VERDICT: [PACKAGING_OK / PACKAGING_CONCERNS / BATCH_RECALLED / CANNOT_DETERMINE]
CONFIDENCE: [number 0-100]
RISK_LEVEL: [LOW / MEDIUM / HIGH / CRITICAL]

WHAT_IS_CERTAIN:
[facts you are 100% sure about]

WHAT_IS_UNCERTAIN:
[things you cannot determine from image alone]

PATIENT_RECOMMENDATION:
[clear advice for the patient in simple English]

NEXT_STEPS:
[numbered list of what patient should do]`

// ─── Call Groq with Retry Logic ──────────────────────────────────
const callGroq = async (payload, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.post(GROQ_API_URL, payload, {
        headers: { 
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 
          'Content-Type': 'application/json' 
        },
        timeout: 60000
      })
      return response?.data?.choices?.[0]?.message?.content || ''
    } catch (error) {
      const isRateLimit = error.response?.status === 429
      if (isRateLimit && i < retries) {
        const delay = (i + 1) * 2000 // Exponential backoff: 2s, 4s
        console.warn(`[GROQ] Rate limited (429). Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}

// ─── Fetch image as base64 ───────────────────────────────────────
export const fetchImageAsBase64 = async (imageUrl) => {
  // If the URL is a remote HTTP(s) address, fetch it via axios.
  // Otherwise treat it as a local file path on the server.
  const isRemote = /^https?:\/\//i.test(imageUrl)

  let mimeType = 'image/jpeg'
  let base64Data = ''

  if (isRemote) {
    // Cloudinary optimisation – fetch a resized version if possible
    let fetchUrl = imageUrl
    if (/res\.cloudinary\.com/i.test(imageUrl) && imageUrl.includes('/upload/')) {
      fetchUrl = imageUrl.replace('/upload/', '/upload/f_jpg,q_90,w_1600/')
    }

    const response = await axios.get(fetchUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    })
    const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    mimeType = supportedTypes.includes(contentType) ? contentType : 'image/jpeg'
    base64Data = Buffer.from(response.data).toString('base64')
  } else {
    // Local file – read directly from disk
    const absolutePath = path.resolve(imageUrl)
    console.log('[IMAGE] Reading local file:', absolutePath)
    const fileBuffer = await fs.promises.readFile(absolutePath)
    // Guess mime type from extension (fallback to jpeg)
    const ext = path.extname(absolutePath).toLowerCase()
    if (['.png'].includes(ext)) mimeType = 'image/png'
    else if (['.webp'].includes(ext)) mimeType = 'image/webp'
    else if (['.gif'].includes(ext)) mimeType = 'image/gif'
    else mimeType = 'image/jpeg'
    base64Data = fileBuffer.toString('base64')
  }

  return { base64Data, mimeType }
}

// ─── Step 1 & 2: Combined OCR + Quality Check ───────────────────
export const performOcrAndQualityCheck = async (base64Data, mimeType) => {
  console.log('[AI SERVICE] Step 1: Running OCR + Quality combined...')
  const payload = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
        { type: 'text', text: COMBINED_OCR_QUALITY_PROMPT }
      ]
    }],
    max_tokens: 1024,
    temperature: 0.1
  }

  const rawResponse = await callGroq(payload)
  
  // Parse Layer 1 fields
  const get = (field) => {
    const match = rawResponse.match(new RegExp(`${field}:\\s*([^\\n]+)`, 'i'))
    const value = match?.[1]?.trim()
    return (!value || value === 'BLANK' || value === 'N/A') ? null : value
  }

  const layer1 = {
    medicineName: get('BRAND_NAME'),
    genericName: get('GENERIC_NAME'),
    manufacturer: get('MANUFACTURER'),
    mrp: get('MRP'),
    batchNumber: get('BATCH_NO'),
    expiryDate: get('EXPIRY'),
    mfgDate: get('MFG_DATE'),
    drugLicense: get('DRUG_LICENSE'),
    manufacturerAddress: get('ADDRESS'),
    requiresPrescription: get('RX_SYMBOL') === 'YES',
    schedule: get('SCHEDULE'),
    hasBarcode: get('BARCODE') === 'YES',
    hasHologram: get('HOLOGRAM') === 'YES',
    rawText: rawResponse
  }

  // Parse Layer 2 fields
  const missingFields = get('MISSING_MANDATORY_FIELDS') || 'NONE'
  const concerns = get('VISUAL_CONCERNS') || 'NONE'
  
  const layer2 = {
    printQuality: get('PRINT_QUALITY'),
    colorConsistency: get('COLOR_CONSISTENCY'),
    fontConsistency: get('FONT_CONSISTENCY'),
    mandatoryFieldsComplete: get('MANDATORY_FIELDS_COMPLETE'),
    alignment: get('ALIGNMENT'),
    securityFeatures: get('SECURITY_FEATURES'),
    tamperSigns: get('TAMPER_SIGNS'),
    missingFields: missingFields === 'NONE' ? [] : missingFields.split(',').map(f => f.trim()),
    visualConcerns: concerns === 'NONE' ? [] : concerns.split(',').map(c => c.trim()),
    grade: get('OVERALL_PACKAGING_GRADE') || 'C',
    verdict: get('PACKAGING_VERDICT') || 'CANNOT_ASSESS',
    rawText: rawResponse
  }

  return { layer1, layer2, rawResponse }
}

// ─── Step 3: Final Safety Assessment ────────────────────────────
export const generateFinalSafetyAssessment = async (ocrAndQualityData, batchStatusText) => {
  console.log('[AI SERVICE] Step 2: Running Final Safety Assessment...')
  const payload = {
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: buildLayer3Prompt(ocrAndQualityData, batchStatusText)
    }],
    max_tokens: 800,
    temperature: 0.1
  }

  const rawResponse = await callGroq(payload)

  const get = (field) => rawResponse.match(new RegExp(`${field}:\\s*([^\\n]+)`, 'i'))?.[1]?.trim()
  const getSection = (section) => {
    const match = rawResponse.match(new RegExp(`${section}:\\n([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, 'i'))
    return match?.[1]?.trim() || ''
  }

  const verdictRaw = get('FINAL_VERDICT') || 'CANNOT_DETERMINE'
  const verdictMap = {
    'PACKAGING_OK': 'GENUINE',
    'PACKAGING_CONCERNS': 'SUSPICIOUS',
    'BATCH_RECALLED': 'FAKE',
    'CANNOT_DETERMINE': 'SUSPICIOUS'
  }

  return {
    verdict: verdictRaw,
    dbStatus: verdictMap[verdictRaw] || 'SUSPICIOUS',
    riskLevel: get('RISK_LEVEL') || 'MEDIUM',
    confidence: Math.min(100, Math.max(0, parseInt(get('CONFIDENCE') || '60'))),
    whatIsCertain: getSection('WHAT_IS_CERTAIN'),
    whatIsUncertain: getSection('WHAT_IS_UNCERTAIN'),
    patientRecommendation: getSection('PATIENT_RECOMMENDATION'),
    nextSteps: getSection('NEXT_STEPS'),
    rawText: rawResponse
  }
}

// ─── Wrapper for backward compatibility or one-shot calls ────────
export const analyzeImage = async (imageUrl, batchFromDB = null) => {
  const { base64Data, mimeType } = await fetchImageAsBase64(imageUrl)
  const { layer1, layer2, rawResponse: ocrRaw } = await performOcrAndQualityCheck(base64Data, mimeType)
  
  let batchStatusText = 'Not checked'
  if (batchFromDB) {
    batchStatusText = batchFromDB.status === 'RECALLED' 
      ? `⚠️ RECALLED — ${batchFromDB.recallReason}` 
      : '✅ Not found in recalled list'
  }
  
  const layer3 = await generateFinalSafetyAssessment(ocrRaw, batchStatusText)
  
  // Build Analysis Text (same logic as before)
  const statusIcon = layer3.riskLevel === 'CRITICAL' ? '🚨' : '✅'
  const finalText = `${statusIcon} **${layer3.riskLevel} RISK** — ${layer3.verdict.replace(/_/g, ' ')}\n\nMedicine: ${layer1.medicineName}\nBatch: ${layer1.batchNumber}\nStatus: ${batchStatusText}`

  return {
    text: finalText,
    status: layer3.dbStatus,
    confidence: layer3.confidence,
    layers: { layer1, layer2, layer3 },
    fields: { ...layer1 },
    medicineDetails: { name: layer1.medicineName, genericName: layer1.genericName, manufacturer: layer1.manufacturer, batchNumber: layer1.batchNumber },
    reasons: [...layer2.visualConcerns, ...layer2.missingFields],
    recommendations: layer3.nextSteps.split('\n').slice(0, 3)
  }
}

// ─── Chat Response ──────────────────────────────────────────────
export const askGroq = async (userMessage, conversationHistory = [], medicineContext = '') => {
  const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile'
  const systemContext = medicineContext
    ? `Analyze this: ${medicineContext}. Answer user questions.`
    : 'Helpful MediGuard AI assistant.'

  const messages = [{ role: 'system', content: systemContext }]
  conversationHistory.forEach(msg => messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }))
  messages.push({ role: 'user', content: userMessage })

  const content = await callGroq({ model: GROQ_CHAT_MODEL, messages, temperature: 0.7, max_tokens: 500 })
  return content
}

// ─── Step 4: Wholesale B2B Invoice Extraction ────────────────────
const INVOICE_ANALYSIS_PROMPT = `You are a strict data extraction bot for pharmaceutical B2B invoices.
Analyze this invoice image. Do NOT describe the image. Extract exactly these 3 fields and nothing else to save tokens.

RESPOND IN THIS EXACT FORMAT:

GSTIN: [extract the 15-character GSTIN of the supplier issuing the invoice. If missing, write BLANK]
INVOICE_NUMBER: [extract the invoice/bill number. If missing, write BLANK]
BATCHES: [extract a comma-separated list of ALL medicine batch numbers found in the line items. If none, write NONE]

CRITICAL: Extract only the data, follow the format exactly.`

export const analyzeInvoice = async (imageUrl) => {
  console.log('[AI SERVICE] Running B2B Invoice Extraction...')
  const { base64Data, mimeType } = await fetchImageAsBase64(imageUrl)
  
  const payload = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct', // Same model as working scanner
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
        { type: 'text', text: INVOICE_ANALYSIS_PROMPT }
      ]
    }],
    max_tokens: 300, // Kept small to avoid token spikes
    temperature: 0.1
  }

  const rawResponse = await callGroq(payload)

  const get = (field) => {
    const match = rawResponse.match(new RegExp(`${field}:\\s*([^\\n]+)`, 'i'))
    const value = match?.[1]?.trim()
    return (!value || value === 'BLANK' || value === 'N/A' || value === 'NONE') ? null : value
  }

  const gstin = get('GSTIN')
  const invoiceNumber = get('INVOICE_NUMBER')
  const batchesStr = get('BATCHES')
  
  const batches = batchesStr ? batchesStr.split(',').map(b => b.trim()).filter(Boolean) : []

  return {
    gstin,
    invoiceNumber,
    batches,
    rawResponse
  }
}


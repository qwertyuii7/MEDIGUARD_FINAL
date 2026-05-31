# 🔍 Codebase Verification & Source Code Mapping

Every single architectural layer, database schema design, and algorithmic lookup described in the system analysis is sourced directly from active modules in the project codebase. You can verify this mapping by checking the following source code locations:

---

### 🛡️ 1. In-Memory Recalled Batch Cache (`batchMap`)
* **Original File**: [`backend/controllers/batch.controller.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/controllers/batch.controller.js#L5-L63)
* **Code Proof**: 
  - Declares the module-level hash-map cache: `let batchMap = new Map()`.
  - `loadBatchMap` pre-caches database records matching `RECALLED` or `UNDER_INVESTIGATION` statuses.
  - Normalizes and indexes each batch code under four distinct formatting permutations to prevent character matching omissions:
    ```javascript
    const keys = [
      batch.batchNumber,
      batch.batchNumber.replace(/[-\/\s]/g, ''),
      batch.batchNumber.toLowerCase(),
      batch.batchNumber.replace(/[-\/\s]/g, '').toLowerCase()
    ]
    ```
  - `findBatchInMap(batchNumber)` performs the fast, constant-time `O(1)` in-memory check before querying MongoDB as a fallback.

---

### 📷 2. Vision Models and Vision OCR Pipeline
* **Original File**: [`backend/services/groq.service.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/services/groq.service.js#L149-L253)
* **Code Proof**:
  - **Layer 1 & 2** OCR and quality inspection utilizes the vision-language model:
    `model: 'meta-llama/llama-4-scout-17b-16e-instruct'` (Line 153).
  - **Layer 3** Final Patient Safety Reasoning uses:
    `model: 'llama-3.3-70b-versatile'` (Line 217).

---

### 💬 3. Gemini 2.0 with Active Search Grounding
* **Original File**: [`backend/controllers/scan.controller.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/controllers/scan.controller.js#L20-L115)
* **Code Proof**:
  - Validates `process.env.GEMINI_API_KEY` (Line 20).
  - Fires an Express network payload to **`gemini-2.0-flash`** model (Line 78).
  - Registers the **`google_search`** active web-search grounding tool (Line 81) to fetch real-time drug guidelines and pricing:
    ```json
    tools: [{ google_search: {} }]
    ```
  - Falls back to Llama-based chat `askGroq` if the Gemini API key is missing (Line 25).

---

### 💊 4. Common Indian Medicines Array (`indianMedicines`)
* **Original File**: [`backend/controllers/medicine.controller.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/controllers/medicine.controller.js#L225-L237)
* **Code Proof**:
  - Defines an array `indianMedicines` containing 30 prominent local drugs (Crocin, Dolo 650, Combiflam, Pan 40, Azithral 500, Metformin 500, Cetirizine, Omeprazole 20, Montair LC, Digene, and 20 others).
  - `searchMedicine` first checks this local array (Line 89), resorting to the external OpenFDA API fetcher `fetchFromFDA` only on a cache miss.

---

### 🧾 5. B2B Wholesale Trust Score Calculations
* **Original File**: [`backend/controllers/wholesale.controller.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/controllers/wholesale.controller.js#L43-L110)
* **Code Proof**:
  - Allocates composite B2B verification trust score points:
    - **Supplier credentials (40 points)**: Granted if `verifySupplier` yields positive results, falling back to **+10 points** if the GSTIN format matches UP (`09`) but is not found in the database. Drops immediately to **0 points** if blacklisted.
    - **Invoice Integrity (20 points)**: **+10 points** for a parsed invoice number, plus **+10 points** if invoice line-item batches are parsed.
    - **Batch Verification (40 points)**: **+20 points** if physical container batch matches invoice batches, and **+20 points** if the batch is verified not to be recalled. Immediate drop to **0 points** if CDSCO lists the batch as fake or recalled.

---

### 📁 6. Database Schema Design and Indexes
* **Supplier Schema**: [`backend/models/Supplier.model.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/models/Supplier.model.js#L44) establishes index `{ gstin: 1 }`.
* **BatchNumber Schema**: [`backend/models/BatchNumber.model.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/models/BatchNumber.model.js#L34-L37) establishes compound index `{ batchNumber: 1, status: 1 }` and text search index `{ medicine: 'text', manufacturer: 'text' }`.
* **Scan Schema**: [`backend/models/Scan.model.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/models/Scan.model.js#L59-L62) defines optimization indexes `{ user: 1, createdAt: -1 }`, `{ result: 1 }`, and `{ 'medicineDetails.name': 1 }`.
* **Chemist Schema**: [`backend/models/Chemist.model.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/models/Chemist.model.js#L12-L15) implements geographic lat/lng coordinate fields used in bounding-box chemist proximity searches.

---

### 📢 7. CDSCO Alert Scraper & Scheduled Cron Task
* **Original File**: [`backend/jobs/cdscoScraper.job.js`](file:///c:/prompts/mediguard/mediguard-4-main/backend/jobs/cdscoScraper.job.js)
* **Code Proof**:
  - Crawls alert portals `'https://cdsco.gov.in/opencms/opencms/en/Notifications/nsq-drugs/'` and `'https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/'` (Line 6).
  - Programs `cron.schedule('0 */6 * * *')` running every 6 hours (Line 195).
  - Sets static alerts representing historical major recalls (e.g. *Paracetamol IP 500mg Batch BNE2401001*, *Ranitidine BNW2404002*, and *Augmentin SPR2024001*) (Lines 84–191).

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import { errorHandler, notFound } from './middleware/error.middleware.js'
import authRoutes from './routes/auth.routes.js'
import scanRoutes from './routes/scan.routes.js'
import reportRoutes from './routes/report.routes.js'
import medicineRoutes from './routes/medicine.routes.js'
import chemistRoutes from './routes/chemist.routes.js'
import alertRoutes from './routes/alert.routes.js'
import batchRoutes from './routes/batch.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import wholesaleRoutes from './routes/wholesale.routes.js'
import { startAllJobs } from './jobs/cdscoScraper.job.js'
import { loadBatchMap } from './controllers/batch.controller.js'

dotenv.config()

const app = express()

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))

// Logging
app.use(morgan('dev'))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve local uploads statically when Cloudinary is disabled
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Database connection middleware for serverless
app.use(async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    console.error('Database connection failed:', error.message)
    res.status(503).json({ 
      success: false, 
      message: 'Database connection temporarily unavailable. Please try again in a few seconds.' 
    })
  }
})

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/scan', scanRoutes)
app.use('/api/v1/reports', reportRoutes)
app.use('/api/v1/medicines', medicineRoutes)
app.use('/api/v1/chemists', chemistRoutes)
app.use('/api/v1/alerts', alertRoutes)
app.use('/api/v1/batch', batchRoutes)
app.use('/api/v1/dashboard', dashboardRoutes)
app.use('/api/v1/wholesale', wholesaleRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'MediGuard API is running', timestamp: new Date() })
})

// Base route to prevent 404 on deployment root
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'MediGuard API is running' })
})

// Error handlers
app.use(notFound)
app.use(errorHandler)


import { runSeed } from './utils/seedData.js'

const PORT = process.env.PORT || 5000

// Only run the server manually and execute background jobs if NOT in a serverless production environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  connectDB().then(async () => {
    app.listen(PORT, async () => {
      console.log(`MediGuard server running on port ${PORT}`)
      try {
        console.log('Running automatic seeding for initial data...')
        await runSeed()
        await loadBatchMap()
        startAllJobs()
        
        // Refresh batch map every 30 minutes locally
        setInterval(loadBatchMap, 30 * 60 * 1000)
      } catch (err) {
        console.error("Startup script error:", err)
      }
    })
  }).catch(err => {
    console.error("Failed to connect to DB during startup", err)
  })
}

// Export the Express app for Vercel Serverless Functions
export default app

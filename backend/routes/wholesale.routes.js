import express from 'express'
import { verifyWholesalePurchase } from '../controllers/wholesale.controller.js'
import { documentUpload } from '../middleware/upload.middleware.js'
import { optionalVerifyToken } from '../middleware/auth.middleware.js'
import rateLimit from 'express-rate-limit'

const router = express.Router()

// Strict rate limiting for the expensive B2B vision endpoint
const wholesaleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many wholesale verification attempts from this IP, please try again after 15 minutes'
  }
})

router.post(
  '/verify',
  optionalVerifyToken,
  wholesaleLimiter,
  documentUpload.fields([
    { name: 'invoiceImage', maxCount: 1 },
    { name: 'medicineImage', maxCount: 1 }
  ]),
  verifyWholesalePurchase
)

export default router

import express from 'express'
import { getAllAlerts, getAlertById, createAlert, updateAlert, deactivateAlert, markAsRead, getUnreadCount } from '../controllers/alert.controller.js'
import { verifyToken } from '../middleware/auth.middleware.js'
import { isAdmin } from '../middleware/role.middleware.js'

const router = express.Router()

// Check if user is logged in for optional auth in getAllAlerts
router.get('/', (req, res, next) => {
  // Mock optional auth middleware behaviour
  verifyToken(req, res, (err) => {
    if (err) req.user = null
    next()
  })
}, getAllAlerts)

router.get('/unread/count', verifyToken, getUnreadCount)
router.post('/:id/read', verifyToken, markAsRead)

// Admin
router.post('/', verifyToken, isAdmin, createAlert)
router.put('/:id', verifyToken, isAdmin, updateAlert)
router.put('/:id/deactivate', verifyToken, isAdmin, deactivateAlert)

router.get('/:id', getAlertById)

export default router

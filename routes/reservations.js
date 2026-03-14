import express from 'express';
import { 
  createReservation, 
  getReservations, 
  cancelReservation, 
  updateReservationStatus 
} from '../controllers/reservations.js';
import authMiddleware from '../middleware/auth.js';
// import roleMiddleware from '../middleware/role.js'; // If needed for specific admin actions

const router = express.Router();

router.post('/', authMiddleware, createReservation);
router.get('/', authMiddleware, getReservations);
router.patch('/:id/cancel', authMiddleware, cancelReservation);
router.patch('/:id/status', authMiddleware, updateReservationStatus);

export default router;

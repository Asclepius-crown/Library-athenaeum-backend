import express from 'express';
import { createAnnouncement, getAnnouncements } from '../controllers/announcements.js';
import authMiddleware from '../middleware/auth.js';
import roleMiddleware from '../middleware/role.js';

const router = express.Router();

router.get('/', authMiddleware, getAnnouncements);
router.post('/', authMiddleware, roleMiddleware(['admin']), createAnnouncement);

export default router;

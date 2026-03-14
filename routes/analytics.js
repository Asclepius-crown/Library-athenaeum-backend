import express from 'express';
import { getAnalytics } from '../controllers/analytics.js';
import authMiddleware from '../middleware/auth.js';
import roleMiddleware from '../middleware/role.js';

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['admin']), getAnalytics);

export default router;

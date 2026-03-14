import express from 'express';
import { addReview, getBookReviews, deleteReview } from '../controllers/reviews.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.get('/:bookId', getBookReviews);
router.post('/', authMiddleware, addReview);
router.delete('/:id', authMiddleware, deleteReview);

export default router;

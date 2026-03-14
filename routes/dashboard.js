import express from 'express';
import authMiddleware from '../middleware/auth.js';
import checkRole from '../middleware/role.js';
import Book from '../models/Book.js';
import User from '../models/User.js';
import BorrowedBook from '../models/BorrowedBook.js';

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const [totalBooks, totalUsers, borrowedCount, overdueCount, genreStats, health, timeline, topReaders, deadStockCount] = await Promise.all([
      Book.countDocuments(),
      User.countDocuments(),
      Book.countDocuments({ status: 'Borrowed' }),
      BorrowedBook.countDocuments({ returnStatus: 'Overdue' }),
      Book.aggregate([
        { $group: { _id: "$genre", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Promise.all([
        Book.countDocuments({ imageUrl: { $in: ["", null] } }),
        Book.countDocuments({ description: { $in: ["", null] } })
      ]),
      BorrowedBook.aggregate([
        {
          $match: {
            borrowDate: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$borrowDate" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      BorrowedBook.aggregate([
        { $group: { _id: "$studentName", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      (async () => {
        const borrowedTitles = await BorrowedBook.distinct('bookTitle');
        return Book.countDocuments({ title: { $nin: borrowedTitles } });
      })()
    ]);

    res.json({
      totalBooks,
      totalUsers,
      borrowedCount,
      overdueCount,
      genreStats,
      health: {
        missingImages: health[0],
        missingDescriptions: health[1]
      },
      timeline,
      topReaders,
      deadStockCount
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

import Book from '../models/Book.js';
import Student from '../models/Student.js';
import BorrowedBook from '../models/BorrowedBook.js';

export const getAnalytics = async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments();
    const totalStudents = await Student.countDocuments();
    const totalBorrowed = await BorrowedBook.countDocuments({ returnStatus: { $ne: 'Returned' } });
    const totalOverdue = await BorrowedBook.countDocuments({ returnStatus: 'Overdue' });

    const genreStats = await Book.aggregate([
      { $group: { _id: "$genre", count: { $sum: 1 } } }
    ]);

    const borrowHistory = await BorrowedBook.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$borrowDate" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    res.json({
      summary: {
        totalBooks,
        totalStudents,
        totalBorrowed,
        totalOverdue
      },
      genreStats,
      borrowHistory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

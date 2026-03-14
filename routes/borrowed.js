import express from 'express';
import BorrowedBook from '../models/BorrowedBook.js';
import Student from '../models/Student.js';
import Book from '../models/Book.js';
import SystemConfig from '../models/SystemConfig.js';
import authMiddleware from '../middleware/auth.js';
import checkRole from '../middleware/role.js';
import { checkReservationsAndNotify } from '../utils/notificationScheduler.js';

const router = express.Router();


// Helper: Calculate Fine (Idea 1 & 4)
// Idea 1: Critical Resource Logic (Higher rates for Core books)
// Idea 4: Exponential Backoff (Higher rates for longer delays)
const calculateFine = (diffDays, isCore) => {
  const baseRate = isCore ? 20 : 5; 
  let fine = 0;

  if (diffDays <= 3) {
    fine = diffDays * (baseRate * 0.2); // Grace/Warning period (20% of base)
  } else if (diffDays <= 7) {
    fine = (3 * (baseRate * 0.2)) + ((diffDays - 3) * baseRate);
  } else {
    fine = (3 * (baseRate * 0.2)) + (4 * baseRate) + ((diffDays - 7) * (baseRate * 2)); // Punitive (200% of base)
  }
  
  return Math.ceil(fine);
};

// GET with pagination, filtering, search, sorting
// Secured: Admins see all, Students see only their own
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search, sort } = req.query;
    const query = {};

    // Role-based filtering
    if (req.user.role === 'student') {
      const student = await Student.findOne({ email: req.user.email });
      if (!student) {
        return res.json({ total: 0, page: Number(page), limit: Number(limit), records: [] });
      }
      query.studentId = student.rollNo;
    }

    if (status) query.returnStatus = status;
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      if (req.user.role === 'student') {
        query.bookTitle = searchRegex;
      } else {
        query.$or = [
          { studentName: searchRegex },
          { studentId: searchRegex },
          { bookTitle: searchRegex }
        ];
      }
    }

    const sortObj = {};
    if (sort) {
      const [field, order] = sort.split(':');
      sortObj[field] = order === 'desc' ? -1 : 1;
    } else {
      sortObj.dueDate = 1;
    }

    const total = await BorrowedBook.countDocuments(query);
    let records = await BorrowedBook.find(query)
      .populate('bookId') // Populate to get book details for fine calc
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Update overdue status and ESTIMATED fines dynamically for display
    // Note: We don't save to DB on every GET to avoid write spikes, 
    // but we return the calculated values. Or we can save if it's critical.
    // For now, let's update in memory for the response, and only save if status changes.
    
    const processedRecords = await Promise.all(records.map(async (record) => {
      // If overdue and not returned
      if (record.returnStatus !== 'Returned' && new Date() > new Date(record.dueDate)) {
        const diffTime = Math.abs(new Date() - new Date(record.dueDate));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let isCore = false;
        if (record.bookId && record.bookId.isCore) {
            isCore = record.bookId.isCore;
        } else if (!record.bookId) {
             // Fallback lookup if bookId missing
             const book = await Book.findOne({ title: record.bookTitle });
             if (book) isCore = book.isCore;
        }

        const newFine = calculateFine(diffDays, isCore);
        
        // We update the record object for the response
        record.returnStatus = 'Overdue';
        record.fineAmount = newFine;
        
        // Optional: Persist to DB if status wasn't overdue before
        if (record.isModified('returnStatus') || record.isModified('fineAmount')) {
            await record.save();
        }
      }
      return record;
    }));

    res.json({ total, page: Number(page), limit: Number(limit), records: processedRecords });
  } catch (err) {
    next(err);
  }
});

// ADMIN ONLY ROUTES
// Create Borrow Record (Idea 2 & 3: Exam Mode & Final Year Priority)
router.post('/', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const { studentId, bookTitle, borrowDate, bookId } = req.body;
    let finalDueDate = new Date(req.body.dueDate); 

    // Fetch Student
    let student = null;
    if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
        student = await Student.findById(studentId);
    }
    if (!student) {
        student = await Student.findOne({ rollNo: studentId });
    }

    // Fetch Book
    let book = null;
    if (bookId) {
        book = await Book.findById(bookId);
    }
    if (!book && bookTitle) {
        book = await Book.findOne({ title: bookTitle });
    }

    // Calculate Intelligent Due Date
    if (student && book) {
        // Idea 3: Final Year Priority
        let loanDuration = 14; // Default
        // If 4th year + Reference/Technical book
        if (student.yearOfStudy === 4 && (book.category === 'Reference' || book.category === 'Technical' || book.isCore)) {
            loanDuration = 30;
        }

        const bDate = new Date(borrowDate || Date.now());
        // Reset finalDueDate based on logic if not manually overridden by admin (or we force logic)
        // Let's assume we want to guide the due date but respect manual input if specifically sent? 
        // For now, let's recalculate it to enforce the system rules.
        finalDueDate = new Date(bDate);
        finalDueDate.setDate(finalDueDate.getDate() + loanDuration);

        // Idea 2: Exam Mode
        const config = await SystemConfig.findOne({ key: 'main_config' });
        if (config && config.examPeriods) {
            for (const period of config.examPeriods) {
                const start = new Date(period.startDate);
                const end = new Date(period.endDate);
                
                if (finalDueDate >= start && finalDueDate <= end) {
                    finalDueDate = new Date(end);
                    finalDueDate.setDate(finalDueDate.getDate() + 1); // Due 1 day after exams
                }
            }
        }
    }

    const record = new BorrowedBook({
        ...req.body,
        dueDate: finalDueDate,
        bookId: book ? book._id : undefined
    });
    
    await record.save();
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

// Update/Return Record
router.put('/:id', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const { returnStatus } = req.body;
    let updateData = { ...req.body };

    // Fine Calculation Logic on Return
    if (returnStatus === 'Returned') {
      const record = await BorrowedBook.findById(req.params.id).populate('bookId');
      if (record) {
        // Trigger Reservation Notification if returning for the first time
        if (record.returnStatus !== 'Returned') {
            const bookId = record.bookId?._id || record.bookId; // Handle populated or unpopulated
            await checkReservationsAndNotify(bookId, record.bookTitle);
        }

        const today = new Date();
        const due = new Date(record.dueDate);
        
        if (today > due) {
          const diffTime = Math.abs(today - due);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          let isCore = false;
          if (record.bookId && record.bookId.isCore) {
             isCore = record.bookId.isCore;
          } else if (!record.bookId) {
             const book = await Book.findOne({ title: record.bookTitle });
             if (book) isCore = book.isCore;
          }

          // Use the unified calculation helper
          const calculatedFine = calculateFine(diffDays, isCore);
          
          if (updateData.fineAmount === undefined) {
             updateData.fineAmount = calculatedFine;
          }
          
          if (updateData.fineAmount > 0) {
             updateData.isFinePaid = false;
          }
        }
      }
    }

    const record = await BorrowedBook.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

// Admin Only: Enable/Unlock Payment for Student
router.patch('/:id/toggle-payment', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const record = await BorrowedBook.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    
    record.isPaymentEnabled = !record.isPaymentEnabled; // Toggle
    await record.save();
    
    res.json(record);
  } catch (err) {
    next(err);
  }
});

// Student/Admin: Complete Payment
router.patch('/:id/pay-fine', authMiddleware, async (req, res, next) => {
  try {
    const { paymentMethod } = req.body; // Expect 'Cash' or 'UPI'
    
    // Security check: If student is paying, ensure payment is enabled
    const record = await BorrowedBook.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (req.user.role !== 'admin' && !record.isPaymentEnabled) {
      return res.status(403).json({ message: 'Payment not enabled by librarian.' });
    }
    
    record.isFinePaid = true;
    record.isPaymentEnabled = false; // Reset after payment
    record.paymentMethod = paymentMethod || 'Cash';
    record.paymentDate = new Date();
    
    await record.save();
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const deleted = await BorrowedBook.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-delete', authMiddleware, checkRole(['admin']), async (req, res, next) => {
  try {
    const { ids } = req.body;
    await BorrowedBook.deleteMany({ _id: { $in: ids } });
    res.json({ message: 'Records deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;

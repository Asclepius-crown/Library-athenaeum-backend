import Reservation from '../models/Reservation.js';
import Book from '../models/Book.js';
import Student from '../models/Student.js';

// Create a reservation
export const createReservation = async (req, res) => {
  try {
    const { bookId } = req.body;
    let { studentId } = req.body;

    // If studentId is not provided, try to find it from the logged-in user
    if (!studentId && req.user && req.user.email) {
        const student = await Student.findOne({ email: req.user.email });
        if (student) {
            studentId = student._id;
        } else {
            return res.status(404).json({ message: 'Student profile not found for this user.' });
        }
    }

    if (!studentId) {
        return res.status(400).json({ message: 'Student ID is required.' });
    }

    // 1. Validate Book
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Optional: Only allow reservation if copies are 0
    // if (book.availableCopies > 0) {
    //   return res.status(400).json({ message: 'Book is currently available. You can borrow it directly.' });
    // }

    // 2. Validate Student (Redundant if we just found it, but good for safety if passed in body)
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // 3. Check for existing active reservation
    const existingReservation = await Reservation.findOne({
      bookId,
      studentId,
      status: 'Active'
    });

    if (existingReservation) {
      return res.status(400).json({ message: 'You already have an active reservation for this book.' });
    }

    const reservation = new Reservation({
      bookId,
      studentId
    });

    await reservation.save();
    res.status(201).json(reservation);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get reservations (with optional filters)
export const getReservations = async (req, res) => {
  try {
    let { studentId, bookId, status } = req.query;

    // If student, force filter by their ID
    if (req.user && req.user.role === 'student') {
        const student = await Student.findOne({ email: req.user.email });
        if (student) {
            studentId = student._id;
        } else {
            return res.json([]); // No profile, no reservations
        }
    }

    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (bookId) filter.bookId = bookId;
    if (status) filter.status = status;

    const reservations = await Reservation.find(filter)
      .populate('bookId', 'title author')
      .populate('studentId', 'name email') // Assuming Student model has name and email
      .sort({ createdAt: -1 });

    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cancel a reservation
export const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findByIdAndUpdate(
      id, 
      { status: 'Cancelled' }, 
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fulfill a reservation (Admin usually does this when checking out, or automatically)
// For now, this might just be a status update
export const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const reservation = await Reservation.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

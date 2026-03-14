import Review from '../models/Review.js';
import Book from '../models/Book.js';

export const addReview = async (req, res) => {
  try {
    const { bookId, studentId, studentName, rating, comment } = req.body;
    
    const review = new Review({ bookId, studentId, studentName, rating, comment });
    await review.save();

    // Update book ratings
    const book = await Book.findById(bookId);
    if (book) {
      const allReviews = await Review.find({ bookId });
      const avgRating = allReviews.reduce((acc, rev) => acc + rev.rating, 0) / allReviews.length;
      book.averageRating = avgRating;
      book.totalReviews = allReviews.length;
      await book.save();
    }

    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getBookReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ bookId: req.params.bookId });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });

    // Update book ratings
    const book = await Book.findById(review.bookId);
    if (book) {
      const allReviews = await Review.find({ bookId: review.bookId });
      if (allReviews.length > 0) {
        const avgRating = allReviews.reduce((acc, rev) => acc + rev.rating, 0) / allReviews.length;
        book.averageRating = avgRating;
        book.totalReviews = allReviews.length;
      } else {
        book.averageRating = 0;
        book.totalReviews = 0;
      }
      await book.save();
    }

    res.json({ message: "Review deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

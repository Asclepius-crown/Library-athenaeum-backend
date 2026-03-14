import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const reviewSchema = new Schema({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
}, { timestamps: true });

// Prevent multiple reviews from the same student for the same book
reviewSchema.index({ bookId: 1, studentId: 1 }, { unique: true });

export default model('Review', reviewSchema);

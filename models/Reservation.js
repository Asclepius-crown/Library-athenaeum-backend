import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const reservationSchema = new Schema({
  bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true }, // Linking to Student model
  reservationDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['Active', 'Fulfilled', 'Cancelled'], 
    default: 'Active' 
  },
  notes: { type: String }
}, { timestamps: true });

// Prevent duplicate reservations for the same book by the same student (if active)
reservationSchema.index({ bookId: 1, studentId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'Active' } });

export default model('Reservation', reservationSchema);

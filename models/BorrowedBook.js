import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const borrowedBookSchema = new Schema({
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  bookId: { type: Schema.Types.ObjectId, ref: 'Book' }, // Added reference to Book model
  bookTitle: { type: String, required: true },
  borrowDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  returnStatus: { type: String, enum: ['Returned', 'Not Returned', 'Overdue'], default: 'Not Returned' },
  fineAmount: { type: Number, default: 0 },
  isFinePaid: { type: Boolean, default: true }, // Default true if fine is 0, logic updates this
  isPaymentEnabled: { type: Boolean, default: false }, // Admin toggles this to allow student payment
  paymentMethod: { type: String, enum: ['Cash', 'UPI', null], default: null },
  paymentDate: { type: Date, default: null },
}, { timestamps: true });

export default model('BorrowedBook', borrowedBookSchema);

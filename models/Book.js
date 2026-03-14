import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const bookSchema = new Schema({
  title: { type: String, required: true },
  author: String,
  genre: { type: String, default: 'Uncategorized' }, // Added genre
  publisher: String, // Added publisher
  height: String,    // Added height
  description: String, // Added description
  imageUrl: String,  // Added imageUrl
  publishedCount: { type: Number, default: 0 },
  isbn: String,
  location: String,
  category: String,
  status: { type: String, enum: ['Available', 'Borrowed'], default: 'Available' },
  borrower: { type: String, default: '' },
  dueDate: Date,
  type: { type: String, enum: ['eBook', 'Audiobook'], default: 'eBook' },
  isFeatured: { type: Boolean, default: false }, // Added featured flag
  isCore: { type: Boolean, default: false }, // Critical resource flag (Idea 1)
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
}, { timestamps: true });

export default model('Book', bookSchema);

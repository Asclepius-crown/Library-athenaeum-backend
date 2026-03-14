import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const announcementSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  targetRole: { type: String, enum: ['all', 'student', 'admin'], default: 'all' },
}, { timestamps: true });

export default model('Announcement', announcementSchema);

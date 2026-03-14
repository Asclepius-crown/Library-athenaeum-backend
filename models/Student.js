import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  rollNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  yearOfStudy: { type: Number, required: true },
  admissionYear: { type: Number, required: true },
  email: { type: String, required: true },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }]
}, { timestamps: true });

export default mongoose.model("Student", studentSchema);

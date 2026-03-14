import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
}, { timestamps: true });

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  next();
});

export default model('User', userSchema);

import express from 'express';
import User from '../models/User.js';
import Student from '../models/Student.js'; // Import Student model
import jwt from 'jsonwebtoken';
import authMiddleware from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, email, password } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ message: 'User already exists' });

      const user = new User({ 
        name, 
        email, 
        passwordHash: password,
        role: 'student' // Force role to student
      });
      await user.save();

      const token = jwt.sign({ user: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });

      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

      const token = jwt.sign({ user: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });

    let studentProfile = null;
    if (user.role === 'student') {
      studentProfile = await Student.findOne({ email: user.email });
    }

    res.json({ user, studentProfile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.post(
  '/change-password',
  authMiddleware,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) return res.status(400).json({ message: 'Current password incorrect' });

      user.passwordHash = newPassword;
      await user.save();

      res.json({ message: 'Password changed successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

export default router;

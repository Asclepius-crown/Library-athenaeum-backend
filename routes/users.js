import express from 'express';
import User from '../models/User.js';
import Student from '../models/Student.js'; // Import Student model
import authMiddleware from '../middleware/auth.js';
import checkRole from '../middleware/role.js';

const router = express.Router();

// GET /api/users - List all users (Admin only)
router.get('/', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users - Create a new user/student (Admin only)
router.post('/', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const { name, email, password, role, rollNo, branch, year } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields: name, email, password' });
    }

    // 1. Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // 2. Create User
    const user = new User({
      name,
      email,
      passwordHash: password,
      role: role || 'student'
    });
    await user.save();

    // 3. If Student, create Student Profile
    let studentProfile = null;
    if (role === 'student' && rollNo) {
      studentProfile = new Student({
        name,
        email,
        rollNo,
        department: branch || 'General',
        yearOfStudy: Number(year) || 1,
        admissionYear: new Date().getFullYear(),
      });
      await studentProfile.save();
    }

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      student: studentProfile
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/:id/role - Update user role (Admin only)
router.put('/:id/role', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { role }, 
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/users/:id - Delete a user and associated data (Admin only)
router.delete('/:id', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete associated Student profile if it exists
    if (user.role === 'student') {
      await Student.findOneAndDelete({ email: user.email });
    }

    // Delete the User
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User and associated data deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

  import jwt from 'jsonwebtoken';
  import User from '../models/User.js';

  export default async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.user).select('-passwordHash');
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      req.user = user;
      next();
    } catch (err) {
      console.error('Auth middleware error:', err);
      res.status(401).json({ message: 'Token is invalid or expired' });
    }
  }

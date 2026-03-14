export default function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      console.warn(`Unauthorized access attempt: No user in request`);
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`Forbidden access attempt: User ${req.user._id} (${req.user.role}) tried to access ${req.method} ${req.originalUrl}`);
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}

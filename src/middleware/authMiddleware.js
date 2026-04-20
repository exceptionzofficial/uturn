const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // If it's the login route, allow it
  if (req.path === '/login') return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If there's no token and it's an admin route, block it
  if (!token) {
    if (req.baseUrl.startsWith('/api/admin') || req.path.startsWith('/admin')) {
      return res.status(401).json({ message: 'Authentication token required' });
    }
    // Bypass for test routes if any? (The user doc mentioned a driver bypass, but here let's just bounce 401 if token is expected)
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'supersecretjwtkey';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });
    if (req.user.role === 'super-admin') return next();
    if (req.user.permissions && req.user.permissions.includes(permission)) return next();
    return res.status(403).json({ message: `Requires ${permission} permission.` });
  };
};

module.exports = { authMiddleware, checkPermission };

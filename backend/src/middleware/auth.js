import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export class AuthService {
  static generateToken(userId) {
    return jwt.sign(
      { userId }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  static extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}

// Middleware to verify JWT
export function authMiddleware(req, res, next) {
  const token = AuthService.extractToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  const decoded = AuthService.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }

  req.userId = decoded.userId;
  next();
}

export default AuthService;

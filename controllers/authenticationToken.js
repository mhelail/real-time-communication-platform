const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate JWT tokens
 * Verifies the token and attaches user info to request
 */
function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Authorization header is required'
            });
        }

        const token = authHeader.split(' ')[1]; // Extract token from 'Bearer [token]'
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token not provided'
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                logger.warn('Token verification failed:', err.message);
                return res.status(403).json({
                    success: false,
                    message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
                });
            }

            req.user = decoded;
            next();
        });
    } catch (error) {
        logger.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
}

module.exports = authenticateToken;

const jwt = require('jsonwebtoken');


function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1]; // Token

if (!token) {
  return res.status(401).json({ message: 'Token not provided' });
}

jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
  if (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }

  req.user = user;
  next();
});

}

module.exports = authenticateToken; 
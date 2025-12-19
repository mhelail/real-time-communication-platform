/**
 * Input validation middleware
 * Validates and sanitizes user inputs
 */

const validateRegister = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  // Username validation
  if (!username || typeof username !== 'string') {
    errors.push('Username is required and must be a string');
  } else if (username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long');
  } else if (username.trim().length > 20) {
    errors.push('Username must be less than 20 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  // Password validation
  if (!password || typeof password !== 'string') {
    errors.push('Password is required and must be a string');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  } else if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Sanitize inputs
  req.body.username = username.trim().toLowerCase();
  next();
};

const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string' || !username.trim()) {
    errors.push('Username is required');
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  req.body.username = username.trim().toLowerCase();
  next();
};

const validateMessage = (req, res, next) => {
  const { content, conversationId } = req.body;
  const errors = [];

  if (!content || typeof content !== 'string' || !content.trim()) {
    errors.push('Message content is required');
  } else if (content.trim().length > 5000) {
    errors.push('Message content must be less than 5000 characters');
  }

  if (!conversationId) {
    errors.push('Conversation ID is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Sanitize content (basic XSS prevention)
  req.body.content = content.trim();
  next();
};

const validateGroup = (req, res, next) => {
  const { groupName, members } = req.body;
  const errors = [];

  if (!groupName || typeof groupName !== 'string' || !groupName.trim()) {
    errors.push('Group name is required');
  } else if (groupName.trim().length < 3) {
    errors.push('Group name must be at least 3 characters long');
  } else if (groupName.trim().length > 50) {
    errors.push('Group name must be less than 50 characters');
  }

  if (!members || !Array.isArray(members)) {
    errors.push('Members must be an array');
  } else if (members.length < 1) {
    errors.push('At least one member is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  req.body.groupName = groupName.trim();
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateMessage,
  validateGroup
};


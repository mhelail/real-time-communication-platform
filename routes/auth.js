const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getConversations,
  searchUsers,
  createOrFindConversation,
  getPrivateMessages,
  getGroupMessages,
  sendMessage,
  getAllUsers,
  getUserGroups,
  createGroup,
  sendGroupMessage,
  getCallHistory
} = require('../controllers/authController');
const authenticateToken = require('../controllers/authenticationToken');
const { validateRegister, validateLogin, validateMessage, validateGroup } = require('../middleware/validator');
const { authLimiter, apiLimiter } = require('../middleware/rateLimiter');

// User registration (with rate limiting and validation)
router.post('/register', authLimiter, validateRegister, register);

// User login (with rate limiting and validation)
router.post('/login', authLimiter, validateLogin, login);

// Search users and groups (with rate limiting)
router.get('/users/search', apiLimiter, authenticateToken, searchUsers);

// Get all users (with rate limiting)
router.get('/users', apiLimiter, authenticateToken, getAllUsers);

// Create or find conversation (with rate limiting)
router.post('/users/conversation', apiLimiter, authenticateToken, createOrFindConversation);

// Get user conversations (with rate limiting)
router.get('/users/conversations', apiLimiter, authenticateToken, getConversations);

// Get private messages (with rate limiting)
router.get('/conversations/:conversationId/messages', apiLimiter, authenticateToken, getPrivateMessages);

// Send message (with rate limiting and validation)
router.post('/messages', apiLimiter, authenticateToken, validateMessage, sendMessage);

// Get user groups (with rate limiting)
router.get('/users/groups', apiLimiter, authenticateToken, getUserGroups);

// Get group messages (with rate limiting)
router.get('/groups/:groupId/messages', apiLimiter, authenticateToken, getGroupMessages);

// Create group (with rate limiting and validation)
router.post('/groups', apiLimiter, authenticateToken, validateGroup, createGroup);

// Send group message (with rate limiting and validation)
router.post('/groups/:groupId/messages', apiLimiter, authenticateToken, validateMessage, sendGroupMessage);

// Get call history (with rate limiting)
router.get('/call-history', apiLimiter, authenticateToken, getCallHistory);

module.exports = router;

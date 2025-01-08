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
} = require('../controllers/authController'); // Controller'ları içe aktar
const authenticateToken = require('../controllers/authenticationToken'); // Kimlik doğrulama için Middleware

// Kullanıcı kaydı
router.post('/register', register);

// Kullanıcı girişi
router.post('/login', login);

// Kullanıcı araması
router.get('/users/search', authenticateToken, searchUsers);

// Kullanıcıları listele
router.get('/users', authenticateToken, getAllUsers);  // Kullanıcıları listelemek için route

// Sohbet başlatma veya bulma
router.post('/users/conversation', authenticateToken, createOrFindConversation);

// Kullanıcıya ait konuşmaları al
router.get('/users/conversations', authenticateToken, getConversations);

// Belirli bir bireysel konuşmanın mesajlarını al
router.get('/conversations/:conversationId/messages', authenticateToken, getPrivateMessages);

// Bireysel konuşmada mesaj gönder
router.post('/messages', authenticateToken, sendMessage);

// Kullanıcı gruplarını listele
router.get('/users/groups', authenticateToken, getUserGroups);  // Kullanıcı gruplarını listelemek için route

// Belirli bir grup konuşmasının mesajlarını al
router.get('/groups/:groupId/messages', authenticateToken, getGroupMessages);  // Grup mesajlarını almak için route

// Yeni grup oluşturma rotası
router.post('/groups', authenticateToken, createGroup);  // Yeni grup oluşturma

// Belirli bir grupta mesaj gönder
router.post('/groups/:groupId/messages', authenticateToken, sendGroupMessage);  // Grup mesajı gönderme

router.get('/call-history', authenticateToken, getCallHistory);

module.exports = router;

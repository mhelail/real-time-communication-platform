const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getConversations,
  searchUsers,
  createOrFindConversation,
  getMessages,   // Yeni fonksiyon içe aktarıldı
  sendMessage    // Yeni fonksiyon içe aktarıldı
} = require('../controllers/authController'); // Controller'ları içe aktar
const authenticateToken = require('../controllers/authenticationToken'); // Kimlik doğrulama için Middleware

// Kullanıcı kaydı
router.post('/register', register);

// Kullanıcı girişi
router.post('/login', login);

// Kullanıcı araması
router.get('/users/search', authenticateToken, searchUsers);

// Sohbet başlatma veya bulma
router.post('/users/conversation', authenticateToken, createOrFindConversation);

// Kullanıcıya ait konuşmaları al
router.get('/users/conversations', authenticateToken, getConversations);

// Belirli bir konuşmanın mesajlarını al
router.get('/conversations/:conversationId/messages', authenticateToken, getMessages);

// Belirli bir konuşmaya mesaj gönder
router.post('/messages', authenticateToken, sendMessage);

// lines to auth.js for message handling
router.post('/messages', authenticateToken, sendMessage); // message handling route


module.exports = router;

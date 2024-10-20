const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController'); // Doğru yolu kontrol edin

// Kullanıcı kaydı
router.post('/register', register);

// Kullanıcı girişi
router.post('/login', login);

module.exports = router;

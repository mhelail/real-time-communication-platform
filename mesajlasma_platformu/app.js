const fs = require('fs');
const https = require('https');
const http = require('http'); // HTTP sunucusu için
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const socketIo = require('socket.io'); // Socket.IO ekleyin
const path = require('path');
const Message = require('./models/Message'); // Sohbet mesajlarını saklamak için Message modelini içe aktarın
const User = require('./models/User'); // Kullanıcı aramak için User modelini içe aktarın
const Conversation = require('./models/Conversation'); // Import the Conversation model

require('dotenv').config();

const app = express();

// Veritabanı bağlantısı
connectDB();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Statik dosyaları sun

// Rotalar
app.use('/api/auth', authRoutes);

// Sohbet arayüzü için HTML dosyasını sun
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

// Giriş/Kayıt Sayfalarını Sun
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

// Kullanıcı arama için rota
app.get('/api/users/search', async (req, res) => {
  const { username } = req.query;
  try {
    const users = await User.find({ username: { $regex: username, $options: 'i' } }).select('username');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Kullanıcı ararken hata oluştu', error });
  }
});

app.get('/', (req, res) => {
  res.send('Sunucu başarıyla çalışıyor!');
});

const sslOptions = {
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem'),
};

// SSL seçeneklerini ve mevcut uygulamayı kullanarak HTTPS sunucusu oluşturma
const PORT = process.env.PORT || 8443;
const httpsServer = https.createServer(sslOptions, app);

// HTTP yönlendirme sunucusu oluştur (isteğe bağlı)
const httpServer = http.createServer(app);
httpServer.listen(8080, () => {
  console.log('HTTP sunucusu 8080 numaralı portta çalışıyor');
});

const io = socketIo(httpsServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// WebSocket bağlantılarını yönet
io.on('connection', (socket) => {
  console.log('Bir kullanıcı bağlandı:', socket.id);

  // Kullanıcı adı kaydetmek için socket objesine atayın
  socket.on('setUsername', (username) => {
    socket.username = username;
  });

  // Kullanıcı belirli bir konuşma odasına katılıyor
  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`DEBUG: Kullanıcı ${socket.username} konuşma ${conversationId} odasına katıldı.`);
  });

  // Gelen mesajları yönet ve yalnızca belirli konuşma odasına yayınla
socket.on('message', async (data) => {
    const { conversationId, from, content } = data;

    try {
        // Konuşmayı veritabanından al ve alıcıyı belirle
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            console.error("DEBUG: Konuşma bulunamadı, ID:", conversationId);
            return;
        }

        // Alıcıyı belirle (gönderen dışında)
        const to = conversation.participants.find(participant => participant !== from);
        if (!to) {
            console.error("DEBUG: Alıcı bulunamadı, katılımcılar:", conversation.participants);
            return;
        }

        // Yeni mesaj oluştur ve kaydet
        const newMessage = new Message({
            conversationId,
            from,
            to,
            content,
            timestamp: new Date()
        });

        await newMessage.save();

        // Mesajı konuşma odasındaki tüm kullanıcılara yayınla
        io.to(conversationId).emit('newMessage', {
            conversationId: newMessage.conversationId, // Include conversationId to properly identify
            from: newMessage.from,
            content: newMessage.content,
            timestamp: newMessage.timestamp
        });

        console.log("DEBUG: Mesaj başarıyla kaydedildi ve yayınlandı:", newMessage);
    } catch (error) {
        console.error('Mesaj kaydedilirken hata oluştu:', error);
    }
});

  // Kullanıcı bağlantısını kesince
  socket.on('disconnect', () => {
    console.log('Bir kullanıcı bağlantısını kesti:', socket.id);
  });
});

// HTTPS sunucusunu başlat
httpsServer.listen(PORT, () => {
  console.log(`Sunucu, ${PORT} numaralı bağlantı noktasında güvenli bir şekilde çalışıyor.`);
});

const authenticateToken = require('./controllers/authenticationToken');

// Korumalı rota
app.get('/api/protected', authenticateToken, (req, res) => {
  res.status(200).json({ message: 'Bu korumalı bir rota', user: req.user });
});

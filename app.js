const fs = require('fs');
const https = require('https');
const http = require('http');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const socketIo = require('socket.io');
const path = require('path');
const Message = require('./models/Message');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const authenticateToken = require('./controllers/authenticationToken');
const jwt = require('jsonwebtoken');
const CallHistory = require('./models/CallHistory');

require('dotenv').config();

const app = express();

// Veritabanı bağlantısı
connectDB();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rotalar
app.use('/api/auth', authRoutes);

// Sohbet arayüzü
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

// Mesajları listele
app.get('/api/auth/messages', authenticateToken, async (req, res) => {
  const { user } = req.query;
  const currentUser = req.user.username;
  try {
    const messages = await Message.find({
      $or: [
        { from: currentUser, to: user },
        { from: user, to: currentUser }
      ]
    }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Mesajlar getirilirken hata oluştu', error });
  }
});

app.get('/api/auth/users/conversations', authenticateToken, async (req, res) => {
  const currentUsername = req.user.username;

  try {
    const conversations = await Conversation.find({
      participants: currentUsername,
    }).select('name type participants lastMessageTimestamp');

    const conversationsWithLastMessage = await Promise.all(conversations.map(async (conversation) => {
      const lastMessage = await Message.findOne({ conversationId: conversation._id }).sort({ timestamp: -1 });
      return {
        ...conversation.toObject(),
        lastMessage: lastMessage ? lastMessage.content : null,
        lastMessageFrom: lastMessage ? lastMessage.from : null,
        lastMessageStatus: lastMessage ? lastMessage.status : null,
      };
    }));

    res.status(200).json({ conversations: conversationsWithLastMessage });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations', error });
  }
});

app.post('/api/auth/users/conversation', authenticateToken, async (req, res) => {
  const { username } = req.body;
  const currentUser = req.user.username;

  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUser, username] },
      type: 'private'
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [currentUser, username],
        type: 'private',
      });
      await conversation.save();
    }

    res.status(201).json({ conversationId: conversation._id });
  } catch (error) {
    console.error('Error creating or finding conversation:', error);
    res.status(500).json({ message: 'Konuşma oluşturulurken veya bulunurken hata oluştu', error });
  }
});

// Konuşma katılımcılarını listele
app.get('/api/auth/messages/participants', authenticateToken, async (req, res) => {
  const currentUser = req.user.username;
  try {
    const messages = await Message.find({
      $or: [{ from: currentUser }, { to: currentUser }]
    });
    const users = new Set();
    messages.forEach(msg => {
      if (msg.from !== currentUser) users.add(msg.from);
      if (msg.to !== currentUser) users.add(msg.to);
    });
    res.json(Array.from(users).map(username => ({ username })));
  } catch (error) {
    res.status(500).json({ message: 'Katılımcılar alınırken hata oluştu', error });
  }
});

app.post('/api/auth/groups/:groupId/messages', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  try {
    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const messages = await Message.find({ conversationId: groupId }).sort('timestamp');
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching group messages', error });
  }
});

// Mesaj silme
app.delete('/api/auth/messages/:id', authenticateToken, async (req, res) => {
  const messageId = req.params.id;
  if (!messageId) {
    return res.status(400).json({ message: 'Message ID is required' });
  }

  try {
    const message = await Message.findByIdAndDelete(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    res.status(200).json({ success: true, message: 'Message deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete message.' });
  }
});

app.post('/api/auth/groups', authenticateToken, async (req, res) => {
  const { groupName, members } = req.body;

  if (!groupName || !members || members.length < 1) {
    return res.status(400).json({ message: 'Group name and at least one member are required' });
  }

  try {
    const currentUser = req.user.username;
    const newGroup = new Conversation({
      type: 'group',
      name: groupName,
      participants: [currentUser, ...members],
      createdAt: new Date(),
      lastMessageTimestamp: new Date(),
    });

    await newGroup.save();
    res.status(201).json({ groupId: newGroup._id, groupName: newGroup.name });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: 'Grup oluşturulurken hata oluştu', error });
  }
});

// Grup konuşmasında mesaj gönder
app.post('/api/auth/groups/:groupId/messages', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { content } = req.body;
  const from = req.user.username;

  try {
    const group = await Conversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const newMessage = new Message({
      conversationId: groupId,
      from,
      content,
      timestamp: new Date(),
    });

    await newMessage.save();

    // Make sure "io" is accessible in this file scope
    io.to(groupId).emit('newMessage', {
      conversationId: groupId,
      from,
      content,
      timestamp: newMessage.timestamp,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message', error });
  }
});

app.get('/api/auth/call-history', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const callHistory = await CallHistory.find({
      $or: [{ caller: username }, { receiver: username }]
    }).sort({ startTime: -1 });

    res.status(200).json({ callHistory });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching call history', error });
  }
});

app.get('/', (req, res) => {
  res.send('Sunucu başarıyla çalışıyor!');
});

const sslOptions = {
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem'),
};

const PORT = process.env.PORT || 8443;
const httpsServer = https.createServer(sslOptions, app);

const io = socketIo(httpsServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let users = {};
let callTimeouts = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('setUsername', (username) => {
    socket.username = username;
    users[username] = socket.id;
    console.log(`DEBUG: User ${username} registered with socket ID: ${socket.id}`);
  });

  // Çağrı başlatma
  socket.on('callInitiated', async ({ from, to }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('incomingCall', { from });
      console.log('Incoming call from', from);

      // 30 saniyelik zamanlayıcı (isteğe göre artır/azalt)
      callTimeouts[from] = setTimeout(async () => {
        const callerSocketId = users[from];
        const receiverSocketId = users[to];

        if (callerSocketId) {
          io.to(callerSocketId).emit('callMissed', { from, to });
        }
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('callEnded');
          console.log(`DEBUG: Call ended for receiver ${to}`);
        }

        // Veritabanına "missed" olarak kaydet
        const newCall = new CallHistory({
          caller: from,
          receiver: to,
          startTime: new Date(),
          endTime: new Date(),
          status: 'missed'
        });

        await newCall.save();
        console.log('DEBUG: Missed call record created:', newCall);
        io.emit('callHistoryUpdated');
      }, 30000);
    }
  });

  // Çağrı kabul
  socket.on('callAccepted', ({ from, to }) => {
    clearTimeout(callTimeouts[to]);
    const targetSocketId = users[from];
    const calleeSocketId = users[to];

    if (targetSocketId) {
      io.to(targetSocketId).emit('callAccepted');
      console.log(`DEBUG: callAccepted event emitted to caller ${from}`);
    }
    if (calleeSocketId) {
      io.to(calleeSocketId).emit('callAccepted');
      console.log(`DEBUG: callAccepted event emitted to callee ${to}`);
    }
  });

  // Çağrı sonlandırma
  socket.on('callEnded', async ({ from, to }) => {
    clearTimeout(callTimeouts[to]);
    const callerSocketId = users[from];
    const receiverSocketId = users[to];

    if (callerSocketId) {
      io.to(callerSocketId).emit('callEnded');
      console.log(`DEBUG: Call ended for caller ${from}`);
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('callEnded');
      console.log(`DEBUG: Call ended for receiver ${to}`);
    }

    // "answered" olarak kaydet
    const newCall = new CallHistory({
      caller: from,
      receiver: to,
      startTime: new Date(),
      endTime: new Date(),
      status: 'answered'
    });
    await newCall.save();
    console.log('DEBUG: Call record created and ended:', newCall);
    io.emit('callHistoryUpdated');
  });

  // Çağrı reddetme
  socket.on('callDeclined', async ({ from, to }) => {
    clearTimeout(callTimeouts[to]);
    const callerSocketId = users[to];
    const calleeSocketId = users[from];

    if (callerSocketId) {
      io.to(callerSocketId).emit('callDeclined', { from, to });
      console.log(`DEBUG: Call declined by ${from}. Notification sent to ${to}`);
    }
    if (calleeSocketId) {
      io.to(calleeSocketId).emit('callEnded');
      console.log(`DEBUG: Call ended for callee (${from})`);
    }

    // "rejected" olarak kaydet
    const newCall = new CallHistory({
      caller: to,
      receiver: from,
      startTime: new Date(),
      endTime: new Date(),
      status: 'rejected'
    });
    await newCall.save();
    console.log('DEBUG: Call record created and declined:', newCall);
    io.emit('callHistoryUpdated');
  });

  // Çağrı iptal
  socket.on('callCancelled', async ({ from, to }) => {
    clearTimeout(callTimeouts[from]);
    const callerSocketId = users[from];
    const receiverSocketId = users[to];

    if (callerSocketId) {
      io.to(callerSocketId).emit('callEnded');
      console.log(`DEBUG: Call cancelled by caller ${from}`);
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('callEnded');
      console.log(`DEBUG: Call cancelled. Notification sent to receiver ${to}`);
    }

    // "cancelled" olarak kaydet
    const newCall = new CallHistory({
      caller: from,
      receiver: to,
      startTime: new Date(),
      endTime: new Date(),
      status: 'cancelled'
    });
    await newCall.save();
    console.log('DEBUG: Call record created and cancelled:', newCall);
    io.emit('callHistoryUpdated');
  });

  // WebRTC Offer
  socket.on('offer', ({ to, description }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('offer', description);
    }
  });

  // WebRTC Answer
  socket.on('answer', ({ to, description }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer', description);
    }
  });

  // ICE Candidate
  socket.on('iceCandidate', ({ to, candidate }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('iceCandidate', candidate);
    }
  });

  // Mute status
  socket.on('muteStatus', ({ from, isMuted }) => {
    console.log(`DEBUG: Mute status updated for ${from}: ${isMuted ? 'Muted' : 'Unmuted'}`);
  });

  // Konuşmaya katıl (odaya join)
  socket.on('joinConversation', async (conversationId) => {
    if (conversationId && socket.username) {
      socket.join(conversationId);

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      if (conversation.type === 'private') {
        await Message.updateMany(
          { conversationId: conversationId, to: socket.username, status: 'teslim edildi' },
          { $set: { status: 'görüldü' } }
        );
      } else if (conversation.type === 'group') {
        await Message.updateMany(
          { conversationId: conversationId, seenBy: { $ne: socket.username } },
          { $push: { seenBy: socket.username } }
        );
      }

      const updatedMessages = await Message.find({ conversationId }).sort({ timestamp: 1 });
      io.to(conversationId).emit('statusUpdate', updatedMessages);
    }
  });

  // Mesaj gönder
  socket.on('message', async (data) => {
    const { conversationId, from, content } = data;
    if (!conversationId || !from || !content) {
      console.error("DEBUG: Mesaj verileri eksik:", { conversationId, from, content });
      return;
    }

    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        console.error("DEBUG: Konuşma bulunamadı, ID:", conversationId);
        return;
      }

      const newMessage = new Message({
        conversationId,
        from,
        content,
        timestamp: new Date(),
      });

      await newMessage.save();

      io.to(conversationId).emit('newMessage', {
        conversationId: newMessage.conversationId,
        from: newMessage.from,
        content: newMessage.content,
        timestamp: newMessage.timestamp,
      });

      console.log("DEBUG: Mesaj kaydedildi ve yayınlandı:", newMessage);
    } catch (error) {
      console.error('Mesaj kaydedilirken hata oluştu:', error);
    }
  });

  // Tek ve tutarlı disconnect handler
  socket.on('disconnect', () => {
    console.log('Bir kullanıcı bağlantısını kesti:', socket.id);
    if (socket.username && users[socket.username]) {
      // Remove from user list
      delete users[socket.username];
    }

  });
});

httpsServer.listen(PORT, () => {
  console.log(`Sunucu, ${PORT} numaralı bağlantı noktasında güvenli bir şekilde çalışıyor.`);
});

// HTTP -> HTTPS yönlendirme
const httpServer = http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  res.end();
});

httpServer.listen(8080, () => {
  console.log('HTTP sunucusu 8080 numaralı portta çalışıyor ve HTTPS yönlendirme yapıyor.');
});

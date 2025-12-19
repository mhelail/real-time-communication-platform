const fs = require('fs');
const https = require('https');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const validateEnvironment = require('./config/environment');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const constants = require('./utils/constants');
const Message = require('./models/Message');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const CallHistory = require('./models/CallHistory');

// Validate environment variables
validateEnvironment();

// Initialize Express app
const app = express();

// Database connection
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"], // Allow inline scripts for HTML pages
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://localhost:8443", "wss://localhost:8443", "https://cdn.socket.io"]
    }
  }
}));

// CORS configuration (more secure)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://localhost:8443', 'http://localhost:8080'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  etag: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);

// Frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'entrance.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// SSL configuration
let sslOptions;
try {
  sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl/key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl/cert.pem'))
  };
} catch (error) {
  logger.error('SSL certificate files not found. Please ensure ssl/key.pem and ssl/cert.pem exist.');
  logger.info('You can generate self-signed certificates using:');
  logger.info('openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes');
  process.exit(1);
}

const PORT = process.env.PORT || 8443;
const HTTP_PORT = process.env.HTTP_PORT || 8080;

// Create HTTPS server
const httpsServer = https.createServer(sslOptions, app);

// Socket.IO setup
const io = socketIo(httpsServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Socket.IO connection management
let users = {}; // username -> socketId mapping
let callTimeouts = {}; // username -> timeout mapping

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    socket.userId = decoded.id;
    socket.username = decoded.username;
    
    next();
  } catch (error) {
    logger.warn('Socket authentication failed:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.username} (${socket.id})`);

  // Set username and track user
  socket.on('setUsername', (username) => {
    if (socket.username !== username) {
      logger.warn(`Username mismatch: socket has ${socket.username}, received ${username}`);
    }
    users[socket.username] = socket.id;
    socket.join(`user:${socket.username}`);
    
    // Update user online status
    User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    }).catch(err => logger.error('Error updating user status:', err));
  });

  // Join conversation room
  socket.on('joinConversation', async (conversationId) => {
    if (!conversationId || !socket.username) {
      logger.warn('Invalid joinConversation request');
      return;
    }

    try {
      socket.join(conversationId);
      logger.debug(`User ${socket.username} joined conversation ${conversationId}`);

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found`);
        return;
      }

      // Update message status
      if (conversation.type === 'private') {
        // Update ALL messages sent TO this user (mark as seen)
        // Remove the status filter to update all messages regardless of current status
        const updateResult = await Message.updateMany(
          {
            conversationId: conversationId,
            to: socket.username,
            from: { $ne: socket.username } // Don't update own messages
          },
          { $set: { status: constants.MESSAGE_STATUS.SEEN } }
        );
        logger.debug(`Updated ${updateResult.modifiedCount} messages to 'seen' for user ${socket.username}`);
      } else if (conversation.type === 'group') {
        await Message.updateMany(
          {
            conversationId: conversationId,
            from: { $ne: socket.username }, // Don't update own messages
            seenBy: { $ne: socket.username }
          },
          { $addToSet: { seenBy: socket.username } }
        );
      }

      const updatedMessages = await Message.find({ conversationId })
        .sort({ timestamp: 1 })
        .limit(100)
        .lean(); // Use lean() for better performance and to ensure proper JSON serialization
      
      // Emit to all users in the conversation room
      io.to(conversationId).emit('statusUpdate', updatedMessages);
      
      // Also emit to the specific user's room for immediate update
      io.to(`user:${socket.username}`).emit('statusUpdate', updatedMessages);
    } catch (error) {
      logger.error('Error in joinConversation:', error);
    }
  });

  // Handle incoming messages
  socket.on('message', async (data) => {
    const { conversationId, from, content } = data;
    
    if (!conversationId || !from || !content) {
      logger.warn('Invalid message data:', { conversationId, from, content: !!content });
      return;
    }

    // Verify sender matches socket user
    if (from !== socket.username) {
      logger.warn(`Message sender mismatch: socket has ${socket.username}, message from ${from}`);
      return;
    }

    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found`);
        return;
      }

      // Verify user is part of conversation
      if (!conversation.participants.includes(from)) {
        logger.warn(`User ${from} not in conversation ${conversationId}`);
        return;
      }

      const newMessage = new Message({
        conversationId,
        from,
        content: content.trim(),
        to: conversation.type === 'private' 
          ? conversation.participants.find(p => p !== from)
          : undefined
      });

      await newMessage.save();

      // Update conversation last message info
      conversation.lastMessageTimestamp = new Date();
      conversation.lastMessage = content.trim();
      conversation.lastMessageFrom = from;
      await conversation.save();

      // Emit to conversation room
      io.to(conversationId).emit('newMessage', {
        _id: newMessage._id,
        conversationId: newMessage.conversationId,
        from: newMessage.from,
        content: newMessage.content,
        timestamp: newMessage.timestamp,
        status: newMessage.status
      });

      logger.debug(`Message sent in conversation ${conversationId} by ${from}`);
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  });

  // Call handling
  socket.on('callInitiated', async ({ from, to }) => {
    if (from !== socket.username) {
      logger.warn(`Call initiator mismatch: socket has ${socket.username}, call from ${from}`);
      return;
    }

    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('incomingCall', { from });
      logger.info(`Call initiated from ${from} to ${to}`);

      // Set timeout for missed call
      callTimeouts[from] = setTimeout(async () => {
        const callerSocketId = users[from];
        const receiverSocketId = users[to];

        if (callerSocketId) {
          io.to(callerSocketId).emit('callMissed', { from, to });
        }
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('callEnded');
        }

        // Save missed call
        try {
          const newCall = new CallHistory({
            caller: from,
            receiver: to,
            startTime: new Date(),
            endTime: new Date(),
            status: constants.CALL_STATUS.MISSED
          });
          await newCall.save();
          io.emit('callHistoryUpdated');
        } catch (error) {
          logger.error('Error saving missed call:', error);
        }

        delete callTimeouts[from];
      }, constants.CALL_TIMEOUT);
    } else {
      logger.warn(`User ${to} not online for call from ${from}`);
      socket.emit('callFailed', { message: 'User is not online' });
    }
  });

  socket.on('callAccepted', ({ from, to }) => {
    if (from !== socket.username) {
      logger.warn(`Call acceptor mismatch: socket has ${socket.username}, call from ${from}`);
      return;
    }

    clearTimeout(callTimeouts[to]);
    const targetSocketId = users[to];
    const calleeSocketId = users[from];

    if (targetSocketId) {
      io.to(targetSocketId).emit('callAccepted');
    }
    if (calleeSocketId) {
      io.to(calleeSocketId).emit('callAccepted');
    }

    delete callTimeouts[to];
    logger.info(`Call accepted between ${from} and ${to}`);
  });

  socket.on('callEnded', async ({ from, to }) => {
    clearTimeout(callTimeouts[from]);
    clearTimeout(callTimeouts[to]);

    const callerSocketId = users[from];
    const receiverSocketId = users[to];

    if (callerSocketId) {
      io.to(callerSocketId).emit('callEnded');
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('callEnded');
    }

    // Save call history
    try {
      const newCall = new CallHistory({
        caller: from,
        receiver: to,
        startTime: new Date(),
        endTime: new Date(),
        status: constants.CALL_STATUS.ANSWERED
      });
      await newCall.save();
      io.emit('callHistoryUpdated');
    } catch (error) {
      logger.error('Error saving call history:', error);
    }

    delete callTimeouts[from];
    delete callTimeouts[to];
    logger.info(`Call ended between ${from} and ${to}`);
  });

  socket.on('callDeclined', async ({ from, to }) => {
    if (from !== socket.username) {
      logger.warn(`Call decliner mismatch: socket has ${socket.username}, call from ${from}`);
      return;
    }

    clearTimeout(callTimeouts[to]);
    const callerSocketId = users[to];
    const calleeSocketId = users[from];

    if (callerSocketId) {
      io.to(callerSocketId).emit('callDeclined', { from, to });
    }
    if (calleeSocketId) {
      io.to(calleeSocketId).emit('callEnded');
    }

    // Save rejected call
    try {
      const newCall = new CallHistory({
        caller: to,
        receiver: from,
        startTime: new Date(),
        endTime: new Date(),
        status: constants.CALL_STATUS.REJECTED
      });
      await newCall.save();
      io.emit('callHistoryUpdated');
    } catch (error) {
      logger.error('Error saving rejected call:', error);
    }

    delete callTimeouts[to];
    logger.info(`Call declined by ${from}`);
  });

  socket.on('callCancelled', async ({ from, to }) => {
    if (from !== socket.username) {
      logger.warn(`Call canceller mismatch: socket has ${socket.username}, call from ${from}`);
      return;
    }

    clearTimeout(callTimeouts[from]);
    const callerSocketId = users[from];
    const receiverSocketId = users[to];

    if (callerSocketId) {
      io.to(callerSocketId).emit('callEnded');
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('callEnded');
    }

    // Save cancelled call
    try {
      const newCall = new CallHistory({
        caller: from,
        receiver: to,
        startTime: new Date(),
        endTime: new Date(),
        status: constants.CALL_STATUS.CANCELLED
      });
      await newCall.save();
      io.emit('callHistoryUpdated');
    } catch (error) {
      logger.error('Error saving cancelled call:', error);
    }

    delete callTimeouts[from];
    logger.info(`Call cancelled by ${from}`);
  });

  // WebRTC signaling
  socket.on('offer', ({ to, description }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('offer', description);
    }
  });

  socket.on('answer', ({ to, description }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer', description);
    }
  });

  socket.on('iceCandidate', ({ to, candidate }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit('iceCandidate', candidate);
    }
  });

  socket.on('muteStatus', ({ from, isMuted }) => {
    logger.debug(`Mute status updated for ${from}: ${isMuted ? 'Muted' : 'Unmuted'}`);
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    logger.info(`User disconnected: ${socket.username} (${socket.id})`);
    
    if (socket.username && users[socket.username]) {
      delete users[socket.username];
      
      // Update user offline status
      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });
      } catch (error) {
        logger.error('Error updating user offline status:', error);
      }
    }

    // Clean up any pending call timeouts
    if (callTimeouts[socket.username]) {
      clearTimeout(callTimeouts[socket.username]);
      delete callTimeouts[socket.username];
    }
  });
});

// Start HTTPS server
httpsServer.listen(PORT, () => {
  logger.info(`HTTPS server running on port ${PORT}`);
});

// HTTP to HTTPS redirect server
const httpServer = http.createServer((req, res) => {
  const host = req.headers.host.replace(`:${HTTP_PORT}`, `:${PORT}`);
  res.writeHead(301, { Location: `https://${host}${req.url}` });
  res.end();
});

httpServer.listen(HTTP_PORT, () => {
  logger.info(`HTTP redirect server running on port ${HTTP_PORT}`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  httpsServer.close(() => {
    logger.info('HTTPS server closed');
  });
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  io.close(() => {
    logger.info('Socket.IO server closed');
  });

  setTimeout(() => {
    logger.info('Forcing shutdown...');
    process.exit(0);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Don't exit in production, just log
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

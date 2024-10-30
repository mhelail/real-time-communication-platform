const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [String], // Array of usernames that are part of the conversation
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Conversation', conversationSchema);

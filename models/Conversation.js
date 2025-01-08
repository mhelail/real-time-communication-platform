const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [String],
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true,
  },
  name: {
    type: String,
    required: function () {
      return this.type === 'group';
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastMessageTimestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Conversation', conversationSchema);

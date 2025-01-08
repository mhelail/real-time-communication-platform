const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  from: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: function() {
      return this.type === 'private';
    },
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['teslim edildi', 'görüldü', 'okunmamış'],
    default: 'teslim edildi'
  },
  seenBy: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('Message', messageSchema);

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: [true, 'Conversation ID is required'],
    index: true
  },
  from: {
    type: String,
    required: [true, 'Sender is required'],
    trim: true,
    index: true
  },
  to: {
    type: String,
    required: function() {
      return this.conversationType === 'private';
    },
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [5000, 'Message content must be less than 5000 characters']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['delivered', 'seen', 'unread'],
      message: 'Status must be one of: delivered, seen, unread'
    },
    default: 'delivered'
  },
  seenBy: {
    type: [String],
    default: []
  },
  editedAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ from: 1, timestamp: -1 });
messageSchema.index({ to: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);

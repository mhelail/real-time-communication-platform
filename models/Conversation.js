const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: {
    type: [String],
    required: [true, 'Participants are required'],
    validate: {
      validator: function(v) {
        return v.length >= 2;
      },
      message: 'At least 2 participants are required'
    },
    index: true
  },
  type: {
    type: String,
    enum: {
      values: ['private', 'group'],
      message: 'Type must be either private or group'
    },
    required: [true, 'Conversation type is required'],
    index: true
  },
  name: {
    type: String,
    required: function () {
      return this.type === 'group';
    },
    trim: true,
    maxlength: [50, 'Group name must be less than 50 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastMessageTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastMessage: {
    type: String
  },
  lastMessageFrom: {
    type: String
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
conversationSchema.index({ participants: 1, type: 1 });
conversationSchema.index({ lastMessageTimestamp: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);

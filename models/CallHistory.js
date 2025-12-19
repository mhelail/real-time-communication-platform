const mongoose = require('mongoose');

const CallHistorySchema = new mongoose.Schema({
  caller: {
    type: String,
    required: [true, 'Caller is required'],
    trim: true,
    index: true
  },
  receiver: {
    type: String,
    required: [true, 'Receiver is required'],
    trim: true,
    index: true
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
    default: Date.now,
    index: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // Duration in seconds
    default: 0
  },
  status: {
    type: String,
    enum: {
      values: ['answered', 'missed', 'rejected', 'cancelled'],
      message: 'Status must be one of: answered, missed, rejected, cancelled'
    },
    required: [true, 'Call status is required'],
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
CallHistorySchema.index({ caller: 1, startTime: -1 });
CallHistorySchema.index({ receiver: 1, startTime: -1 });
CallHistorySchema.index({ status: 1, startTime: -1 });

module.exports = mongoose.model('CallHistory', CallHistorySchema);

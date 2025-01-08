const mongoose = require('mongoose');

const CallHistorySchema = new mongoose.Schema({
  caller: { type: String, required: true },  // Arayan kişi
  receiver: { type: String, required: true },  // Aranan kişi
  startTime: { type: Date, required: true },  // Aramanın başladığı zaman
  endTime: { type: Date },  // Aramanın bittiği zaman
  status: { type: String, enum: ['answered', 'missed', 'rejected' ,'cancelled'], required: true },  // Arama durumu
}, { timestamps: true });

module.exports = mongoose.model('CallHistory', CallHistorySchema);

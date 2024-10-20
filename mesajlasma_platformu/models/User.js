const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    uuid: {
        type: String,
        default: uuidv4, // Kayıt sırasında otomatik UUID oluştur
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;

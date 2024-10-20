const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB'ye bağlantı sağlandı");
    } catch (error) {
        console.error("MongoDB bağlantı hatası:", error);
        process.exit(1); // Bağlantı hatası durumunda uygulamayı kapat
    }
};

module.exports = connectDB;

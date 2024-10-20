const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const app = express();

// Veritabanı bağlantısı
connectDB();

// Middleware
app.use(express.json());

// Route'lar
app.use('/api/auth', authRoutes);

// Sunucuyu başlat
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
});

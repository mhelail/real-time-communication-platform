const fs = require('fs'); 
const https = require('https');

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

app.get('/', (req, res) => {
  res.send('Sunucu başarıyla çalışıyor!');
});

const sslOptions = {
  key: fs.readFileSync('ssl/key.pem'),
  cert: fs.readFileSync('ssl/cert.pem'),
};


// Sunucuyu başlat
// Creating HTTPS server using SSL options and the existing app
const PORT = process.env.PORT || 8443;
const httpsServer = https.createServer(sslOptions, app);

// Start the HTTPS server
httpsServer.listen(PORT, () => {
  console.log(`Sunucu, ${PORT} numaralı bağlantı noktasında güvenli bir şekilde çalışıyor.`);
});

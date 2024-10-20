const fs = require('fs');           // File system module to read files
const https = require('https');     // HTTPS module to create a secure server
const http = require('http');       // HTTP module for optional redirection
const express = require('express'); // Express framework

// Express app Initialization 
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Helmet for security headers
const helmet = require('helmet');
app.use(helmet());

//  Enforcing HTTPS in Express (in case of proxies)
app.use((req, res, next) => {
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    next();
  } else {
    res.redirect(`https://${req.headers.host}${req.url}`);
  }
});

// Definning routes
app.get('/', (req, res) => {
  res.send('Hello, Secure World!');
});

// certificate and key files
const sslOptions = {
  key: fs.readFileSync('ssl/key.pem'),   // the path to key file
  cert: fs.readFileSync('ssl/cert.pem'), // path to certificate file
};

// HTTPS server
const httpsServer = https.createServer(sslOptions, app);

// Starting HTTPS server on port 8443
httpsServer.listen(8443, () => {
  console.log('HTTPS Server running on port 8443');
});

// HTTP server to redirect to HTTPS
const httpApp = express();

httpApp.use((req, res) => {
  res.redirect(`https://${req.headers.host}${req.url}`);
});

const httpServer = http.createServer(httpApp);

// Starting HTTP server on port 80 to redirect to HTTPS
httpServer.listen(80, () => {
  console.log('HTTP Server running on port 80 and redirecting to HTTPS');
});

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000, // Increased timeout
            socketTimeoutMS: 45000,
        };

        logger.info('Attempting to connect to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, options);
        logger.info('MongoDB connected successfully');

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed through app termination');
            process.exit(0);
        });

    } catch (error) {
        logger.error('MongoDB connection failed:', error.message);
        logger.error('');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('  MONGODB CONNECTION ERROR');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('');
        logger.error('Possible solutions:');
        logger.error('');
        logger.error('1. Start MongoDB locally:');
        logger.error('   - Windows: Check if MongoDB service is running');
        logger.error('     Run: net start MongoDB (as Administrator)');
        logger.error('   - Linux/Mac: sudo systemctl start mongod');
        logger.error('   - Or run: mongod');
        logger.error('');
        logger.error('2. Use MongoDB Atlas (Cloud):');
        logger.error('   - Sign up at https://www.mongodb.com/cloud/atlas');
        logger.error('   - Create a free cluster');
        logger.error('   - Get connection string and update MONGODB_URI in .env');
        logger.error('');
        logger.error('3. Check your MONGODB_URI in .env file:');
        logger.error(`   Current: ${process.env.MONGODB_URI || 'NOT SET'}`);
        logger.error('');
        logger.error('4. Verify MongoDB is installed:');
        logger.error('   Run: mongod --version');
        logger.error('');
        logger.error('═══════════════════════════════════════════════════════════');
        logger.error('');
        process.exit(1);
    }
};

module.exports = connectDB;

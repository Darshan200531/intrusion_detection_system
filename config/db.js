const mongoose = require('mongoose');
const { initBlockedIps } = require('../services/blocker');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hids');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Sync blocked IPs stored in DB or historical logs
        await initBlockedIps();
    } catch (error) {
        console.error(`❌ MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;

const mongoose = require('mongoose');
const os = require('os');

const fileBaselineSchema = new mongoose.Schema({
    filePath: { type: String, required: true, unique: true },
    hash: { type: String, required: true },
    algorithm: { type: String, default: 'SHA-256' },
    hostname: { type: String, default: os.hostname() },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FileBaseline', fileBaselineSchema);

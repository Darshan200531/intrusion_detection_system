const mongoose = require('mongoose');

const blockedIPSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    reason: { type: String, default: 'Brute force attack detected' },
    service: { type: String, default: 'System' },
    status: { type: String, enum: ['blocked', 'unblocked'], default: 'blocked' },
    blockedAt: { type: Date, default: Date.now },
    unblockedAt: { type: Date }
});

module.exports = mongoose.model('BlockedIP', blockedIPSchema);

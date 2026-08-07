const mongoose = require('mongoose');

const sshLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    sourceIp: { type: String, required: true },
    username: { type: String },
    eventType: { type: String, required: true }, // e.g., 'failed_login', 'success_login', 'attack', 'blocked_attempt'
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    message: { type: String },
    detectionRule: { type: String },
    status: { type: String, enum: ['alerted', 'logged'], default: 'logged' }
});

module.exports = mongoose.model('SSHLog', sshLogSchema);

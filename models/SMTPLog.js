const mongoose = require('mongoose');

const smtpLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    sourceIp: { type: String, required: true },
    username: { type: String },
    eventType: { type: String, required: true }, // e.g., 'auth_success', 'auth_failure', 'open_relay', 'high_rate', 'spam', 'large_attachment', 'blacklisted_ip'
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    message: { type: String },
    detectionRule: { type: String },
    status: { type: String, enum: ['alerted', 'logged'], default: 'logged' }
});

module.exports = mongoose.model('SMTPLog', smtpLogSchema);

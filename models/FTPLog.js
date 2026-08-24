const mongoose = require('mongoose');

const ftpLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    sourceIp: { type: String, required: true },
    username: { type: String },
    filename: { type: String },
    action: { type: String }, // e.g., 'UPLOAD', 'DOWNLOAD', 'LOGIN', 'DELETE'
    eventType: { type: String, required: true }, // e.g., 'failed_login', 'success_login', 'anonymous_login', 'file_upload', 'file_download', 'file_delete'
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    message: { type: String },
    reason: { type: String },
    detectionRule: { type: String },
    status: { type: String, enum: ['alerted', 'logged'], default: 'logged' }
});

module.exports = mongoose.model('FTPLog', ftpLogSchema);

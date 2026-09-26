const mongoose = require('mongoose');
const os = require('os');

const fileIntegrityEventSchema = new mongoose.Schema({
    filePath: { type: String, required: true },
    eventType: { 
        type: String, 
        enum: ['FILE_MODIFIED', 'FILE_DELETED', 'FILE_CREATED', 'INTEGRITY_CHECK', 'FILE_UNACCESSIBLE'], 
        required: true 
    },
    oldHash: { type: String, default: null },
    newHash: { type: String, default: null },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
    timestamp: { type: Date, default: Date.now },
    hostname: { type: String, default: os.hostname() },
    status: { type: String, enum: ['alerted', 'logged', 'resolved'], default: 'alerted' },
    message: { type: String }
});

module.exports = mongoose.model('FileIntegrityEvent', fileIntegrityEventSchema);

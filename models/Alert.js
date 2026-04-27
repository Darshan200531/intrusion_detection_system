const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        index: true
    },
    failedAttemptsCount: {
        type: Number,
        required: true
    },
    timeWindowSeconds: {
        type: Number,
        default: 120
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'HIGH'
    },
    resolved: {
        type: Boolean,
        default: false
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index for querying unresolved alerts
alertSchema.index({ resolved: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    ip: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        default: 'unknown'
    },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILED'],
        required: true
    },
    rawLogLine: {
        type: String,
        default: ''
    },
    source: {
        type: String,
        enum: ['linux-auth', 'custom', 'unknown'],
        default: 'unknown'
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

// Compound index for efficient querying by IP and time range
logSchema.index({ ip: 1, timestamp: -1 });

module.exports = mongoose.model('Log', logSchema);

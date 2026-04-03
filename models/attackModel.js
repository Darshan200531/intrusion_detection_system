const mongoose = require('mongoose');

const attackSchema = new mongoose.Schema({
    ip: String,
    attempts: Number,
    timestamp: Date
});

module.exports = mongoose.model('Attack', attackSchema);
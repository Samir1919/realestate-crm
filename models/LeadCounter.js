const mongoose = require('mongoose');

const LeadCounterSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    seq: {
        type: Number,
        default: 0
    }
});

const LeadCounter = mongoose.model('LeadCounter', LeadCounterSchema);

module.exports = LeadCounter;

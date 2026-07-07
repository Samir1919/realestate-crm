const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^[a-z0-9_-]+$/
    },
    permissions: {
        type: [String],
        default: []
    },
    system: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Role', roleSchema);

const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^[a-z0-9:_-]+$/
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    system: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Permission', permissionSchema);

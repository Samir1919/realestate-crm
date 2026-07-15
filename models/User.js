const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true, default: 'viewer', lowercase: true, trim: true },
    createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function hashPasswordBeforeSave() {
    if (!this.isModified('password')) {
        return;
    }

    const plainPassword = String(this.password || '').trim();
    if (plainPassword.startsWith('$2')) {
        return;
    }

    this.password = await bcrypt.hash(plainPassword, SALT_ROUNDS);
});

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
    const inputPassword = String(plainPassword || '');
    return bcrypt.compare(inputPassword, String(this.password || ''));
};

module.exports = mongoose.model('User', userSchema);

const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
    '123456789012345',
    'adminadminadmin',
    'letmeinletmeinletmein',
    'password123456',
    'passwordpassword',
    'qwertyuiopasdfg'
]);

function countCodePoints(value) {
    return Array.from(String(value || '')).length;
}

function validateNewPassword(password) {
    const value = String(password || '');
    const length = countCodePoints(value);

    if (length < MIN_PASSWORD_LENGTH) {
        return {
            valid: false,
            reason: 'too_short',
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        };
    }

    if (length > MAX_PASSWORD_LENGTH) {
        return {
            valid: false,
            reason: 'too_long',
            message: `Password must be no more than ${MAX_PASSWORD_LENGTH} characters.`
        };
    }

    const normalized = value.normalize('NFKC').trim().toLowerCase();
    if (COMMON_PASSWORDS.has(normalized)) {
        return {
            valid: false,
            reason: 'common_password',
            message: 'Choose a less common password or passphrase.'
        };
    }

    return { valid: true, reason: null, message: null };
}

module.exports = {
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    countCodePoints,
    validateNewPassword
};

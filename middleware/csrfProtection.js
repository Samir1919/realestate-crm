const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_BYTE_LENGTH = 32;

function generateToken() {
    return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

function safeCompare(a, b) {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');

    if (left.length !== right.length || left.length === 0) {
        return false;
    }

    return crypto.timingSafeEqual(left, right);
}

function ensureSessionToken(req) {
    if (!req.session) {
        return '';
    }

    if (!req.session.csrfToken) {
        req.session.csrfToken = generateToken();
    }

    return req.session.csrfToken;
}

function readRequestToken(req) {
    const headerToken = req.get('x-csrf-token') || req.get('csrf-token');
    if (headerToken) {
        return String(headerToken);
    }

    return String(req.body?._csrf || '');
}

function csrfProtection(req, res, next) {
    const sessionToken = ensureSessionToken(req);
    res.locals.csrfToken = sessionToken;

    if (SAFE_METHODS.has(String(req.method || '').toUpperCase())) {
        return next();
    }

    const requestToken = readRequestToken(req);
    if (!safeCompare(requestToken, sessionToken)) {
        return res.status(403).send('Invalid CSRF token');
    }

    return next();
}

module.exports = {
    csrfProtection
};

const crypto = require('crypto');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function createSecurityHeaders({ hstsEnabled = process.env.SECURITY_HSTS_ENABLED === 'true' } = {}) {
    return helmet({
        contentSecurityPolicy: false,
        strictTransportSecurity: hstsEnabled
            ? {
                maxAge: 15552000,
                includeSubDomains: false,
                preload: false
            }
            : false,
        referrerPolicy: { policy: 'no-referrer' },
        xFrameOptions: { action: 'deny' }
    });
}

function renderRateLimitResponse(req, res) {
    return res.status(429).render('auth/login', {
        error: 'Too many login attempts. Please try again later.'
    });
}

function accountAndIpKey(req) {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    return `${ipKeyGenerator(req.ip)}:${emailHash}`;
}

function createLoginRateLimiters() {
    const commonOptions = {
        windowMs: LOGIN_WINDOW_MS,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        handler: renderRateLimitResponse
    };

    return [
        rateLimit({
            ...commonOptions,
            limit: 25,
            requestPropertyName: 'loginIpRateLimit'
        }),
        rateLimit({
            ...commonOptions,
            limit: 5,
            keyGenerator: accountAndIpKey,
            requestPropertyName: 'loginAccountRateLimit'
        })
    ];
}

module.exports = {
    LOGIN_WINDOW_MS,
    accountAndIpKey,
    createLoginRateLimiters,
    createSecurityHeaders
};

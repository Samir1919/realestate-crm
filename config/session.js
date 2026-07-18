const { MongoStore, createWebCryptoAdapter } = require('connect-mongo');

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const DEFAULT_SESSION_COLLECTION = 'sessions';

function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true') {
        return true;
    }
    if (normalized === 'false') {
        return false;
    }

    throw new Error('SESSION_COOKIE_SECURE must be either true or false');
}

function resolveSessionSecret(env) {
    const configuredSecret = String(env.SESSION_SECRET || '').trim();

    if (env.NODE_ENV === 'production' && configuredSecret.length < 32) {
        throw new Error('SESSION_SECRET must be at least 32 characters in production');
    }

    return configuredSecret || 'development-only-session-secret';
}

function createSessionConfig(env = process.env, dependencies = {}) {
    const storeFactory = dependencies.storeFactory || ((options) => MongoStore.create(options));
    const cryptoAdapterFactory = dependencies.cryptoAdapterFactory || createWebCryptoAdapter;
    const secret = resolveSessionSecret(env);
    const mongoUrl = env.SESSION_STORE_MONGO_URI
        || env.MONGO_URI
        || 'mongodb://127.0.0.1:27017/realestate_crm';
    const collectionName = String(env.SESSION_COLLECTION || DEFAULT_SESSION_COLLECTION).trim();

    if (!/^[A-Za-z0-9._-]+$/.test(collectionName)) {
        throw new Error('SESSION_COLLECTION contains unsupported characters');
    }

    const store = storeFactory({
        mongoUrl,
        collectionName,
        ttl: SESSION_TTL_SECONDS,
        autoRemove: 'native',
        touchAfter: 5 * 60,
        cryptoAdapter: cryptoAdapterFactory({ secret })
    });

    return {
        name: env.SESSION_COOKIE_NAME || 'crm.sid',
        secret,
        store,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: parseBoolean(env.SESSION_COOKIE_SECURE, env.NODE_ENV === 'production'),
            maxAge: SESSION_TTL_SECONDS * 1000
        }
    };
}

module.exports = {
    SESSION_TTL_SECONDS,
    createSessionConfig,
    parseBoolean,
    resolveSessionSecret
};

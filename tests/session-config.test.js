const test = require('node:test');
const assert = require('node:assert/strict');
const {
    SESSION_TTL_SECONDS,
    createSessionConfig,
    parseBoolean,
    resolveSessionSecret
} = require('../config/session');

function createTestDependencies(capturedStoreOptions) {
    return {
        storeFactory(options) {
            Object.assign(capturedStoreOptions, options);
            return { type: 'test-mongo-store' };
        },
        cryptoAdapterFactory({ secret }) {
            return { type: 'test-crypto-adapter', secret };
        }
    };
}

test('production session config uses encrypted MongoDB-backed storage', () => {
    const storeOptions = {};
    const config = createSessionConfig({
        NODE_ENV: 'production',
        MONGO_URI: 'mongodb://db01/crm_prod',
        SESSION_SECRET: 'a'.repeat(64),
        SESSION_COOKIE_SECURE: 'false'
    }, createTestDependencies(storeOptions));

    assert.equal(config.store.type, 'test-mongo-store');
    assert.equal(storeOptions.mongoUrl, 'mongodb://db01/crm_prod');
    assert.equal(storeOptions.collectionName, 'sessions');
    assert.equal(storeOptions.ttl, SESSION_TTL_SECONDS);
    assert.equal(storeOptions.autoRemove, 'native');
    assert.equal(storeOptions.touchAfter, 300);
    assert.equal(storeOptions.cryptoAdapter.type, 'test-crypto-adapter');
    assert.equal(config.cookie.maxAge, SESSION_TTL_SECONDS * 1000);
    assert.equal(config.cookie.secure, false);
    assert.equal(config.cookie.httpOnly, true);
    assert.equal(config.cookie.sameSite, 'lax');
});

test('production defaults secure cookies to true for HTTPS publication', () => {
    const config = createSessionConfig({
        NODE_ENV: 'production',
        MONGO_URI: 'mongodb://db01/crm_prod',
        SESSION_SECRET: 'b'.repeat(64)
    }, createTestDependencies({}));

    assert.equal(config.cookie.secure, true);
});

test('production rejects a missing or short session secret', () => {
    assert.throws(
        () => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'too-short' }),
        /at least 32 characters/
    );
});

test('cookie security flag only accepts explicit booleans', () => {
    assert.equal(parseBoolean('true', false), true);
    assert.equal(parseBoolean('false', true), false);
    assert.throws(() => parseBoolean('yes', false), /true or false/);
});

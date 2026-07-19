const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { getDeletionDenial, getRoleChangeDenial } = require('../utils/adminAccountPolicy');
const { __testables } = require('../utils/auditLogger');
const {
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    countCodePoints,
    validateNewPassword
} = require('../utils/passwordPolicy');

test('password policy accepts long passphrases and preserves spaces', () => {
    const password = '  correct horse battery staple  ';
    assert.equal(validateNewPassword(password).valid, true);
    assert.equal(countCodePoints(password), 32);
});

test('password policy enforces Unicode-aware length boundaries', () => {
    assert.equal(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1)).reason, 'too_short');
    assert.equal(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH)).valid, true);
    assert.equal(validateNewPassword('🔐'.repeat(MIN_PASSWORD_LENGTH)).valid, true);
    assert.equal(validateNewPassword('a'.repeat(MAX_PASSWORD_LENGTH + 1)).reason, 'too_long');
});

test('password policy rejects locally blocked common passwords', () => {
    assert.equal(validateNewPassword(' PasswordPassword ').reason, 'common_password');
});

test('admin policy blocks self-demotion and last-admin demotion', () => {
    assert.equal(getRoleChangeDenial({
        actorId: '1', targetId: '1', currentRole: 'admin', nextRole: 'viewer', adminCount: 2
    }), 'self_demotion');
    assert.equal(getRoleChangeDenial({
        actorId: '2', targetId: '1', currentRole: 'admin', nextRole: 'viewer', adminCount: 1
    }), 'last_admin');
    assert.equal(getRoleChangeDenial({
        actorId: '2', targetId: '1', currentRole: 'admin', nextRole: 'viewer', adminCount: 2
    }), null);
});

test('admin policy blocks self-deletion and last-admin deletion', () => {
    assert.equal(getDeletionDenial({
        actorId: '1', targetId: '1', targetRole: 'viewer', adminCount: 0
    }), 'self_deletion');
    assert.equal(getDeletionDenial({
        actorId: '2', targetId: '1', targetRole: 'admin', adminCount: 1
    }), 'last_admin');
});

test('audit IP uses trusted Express resolution instead of a raw forwarding header', () => {
    const resolved = __testables.resolveIpAddress({
        ip: '198.51.100.10',
        headers: { 'x-forwarded-for': '203.0.113.99' },
        socket: { remoteAddress: '192.0.2.20' }
    });
    assert.equal(resolved, '198.51.100.10');
});

test('user handlers do not expose raw exception messages to browsers', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'controllers', 'user', 'handlers.js'),
        'utf8'
    );
    assert.doesNotMatch(source, /send\(err\.message\)/);
    assert.doesNotMatch(source, /render\([^\n]+error:\s*err\.message/);
    assert.doesNotMatch(source, /encodeURIComponent\(err\.message\)/);
});

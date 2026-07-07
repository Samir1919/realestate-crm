const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizePhoneNumber, normalizePhoneNumber, isValidPhoneNumber } = require('../utils/phone');

test('removes spaces, dashes, and symbols from phone input', () => {
    assert.equal(sanitizePhoneNumber('01 234-567 890'), '01234567890');
    assert.equal(sanitizePhoneNumber('+88 (017)-11 22 33 44'), '+8801711223344');
    assert.equal(sanitizePhoneNumber('00 1 (415) 555-2671'), '+14155552671');
});

test('returns empty string for missing or invalid phone-like input', () => {
    assert.equal(sanitizePhoneNumber(undefined), '');
    assert.equal(sanitizePhoneNumber(null), '');
    assert.equal(sanitizePhoneNumber('---'), '');
});

test('accepts local and international phone numbers', () => {
    assert.equal(isValidPhoneNumber('01711223344'), true);
    assert.equal(isValidPhoneNumber('+8801711223344'), true);
    assert.equal(isValidPhoneNumber('+14155552671'), true);
    assert.equal(isValidPhoneNumber('+442071838750'), true);
    assert.equal(isValidPhoneNumber('14155552671'), true);
});

test('rejects invalid phone numbers', () => {
    assert.equal(isValidPhoneNumber('12345'), false);
    assert.equal(isValidPhoneNumber('+999123'), false);
    assert.equal(isValidPhoneNumber('abc'), false);
});

test('normalizes valid numbers to canonical e164 format', () => {
    assert.equal(normalizePhoneNumber('01711-223344'), '+8801711223344');
    assert.equal(normalizePhoneNumber('+1 (415) 555-2671'), '+14155552671');
    assert.equal(normalizePhoneNumber('0044 20 7183 8750'), '+442071838750');
});
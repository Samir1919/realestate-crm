const test = require('node:test');
const assert = require('node:assert/strict');
const { formatLeadReference } = require('../utils/leadReference');

test('formats sequential lead references with zero padding', () => {
    assert.equal(formatLeadReference(1), 'LD-000001');
    assert.equal(formatLeadReference(42), 'LD-000042');
    assert.equal(formatLeadReference(123456), 'LD-123456');
});

test('supports custom prefixes and widths', () => {
    assert.equal(formatLeadReference(7, 'LEAD', 8), 'LEAD-00000007');
});

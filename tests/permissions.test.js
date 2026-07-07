const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccess } = require('../utils/permissions');

test('admin can perform all lead actions', () => {
    assert.equal(canAccess('admin', 'viewLeads'), true);
    assert.equal(canAccess('admin', 'createLead'), true);
    assert.equal(canAccess('admin', 'updateLead'), true);
    assert.equal(canAccess('admin', 'deleteLead'), true);
});

test('sales users can create and update but not delete leads', () => {
    assert.equal(canAccess('sales', 'viewLeads'), true);
    assert.equal(canAccess('sales', 'createLead'), true);
    assert.equal(canAccess('sales', 'updateLead'), true);
    assert.equal(canAccess('sales', 'deleteLead'), false);
});

test('viewers can only view leads', () => {
    assert.equal(canAccess('viewer', 'viewLeads'), true);
    assert.equal(canAccess('viewer', 'createLead'), false);
    assert.equal(canAccess('viewer', 'updateLead'), false);
    assert.equal(canAccess('viewer', 'deleteLead'), false);
});

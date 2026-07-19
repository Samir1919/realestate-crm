const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccess } = require('../utils/permissions');

test('admin can perform all lead actions', () => {
    assert.equal(canAccess('admin', 'leads.view.all'), true);
    assert.equal(canAccess('admin', 'leads.create.all'), true);
    assert.equal(canAccess('admin', 'leads.update.all'), true);
    assert.equal(canAccess('admin', 'leads.delete.all'), true);
    assert.equal(canAccess('admin', 'reports.activity.view'), true);
});

test('sales users have own-scope create and update but cannot delete', () => {
    assert.equal(canAccess('sales', 'leads.view.own'), true);
    assert.equal(canAccess('sales', 'leads.create.own'), true);
    assert.equal(canAccess('sales', 'leads.update.own'), true);
    assert.equal(canAccess('sales', 'leads.delete.own'), false);
    assert.equal(canAccess('sales', 'leads.view.all'), false);
});

test('viewers can only view leads', () => {
    assert.equal(canAccess('viewer', 'leads.view.all'), true);
    assert.equal(canAccess('viewer', 'leads.create.all'), false);
    assert.equal(canAccess('viewer', 'leads.update.all'), false);
    assert.equal(canAccess('viewer', 'leads.delete.all'), false);
});

test('legacy permission keys still resolve against taxonomy roles', () => {
    assert.equal(canAccess('admin', 'viewLeads'), true);
    assert.equal(canAccess('sales', 'createLead'), true);
    assert.equal(canAccess('sales', 'deleteLead'), false);
});

test('assign role is split from manage users', () => {
    assert.equal(canAccess('admin', 'users.assignRole'), true);
    assert.equal(canAccess('sales', 'users.assignRole'), false);
    assert.equal(canAccess('viewer', 'users.assignRole'), false);
});

test('activity report permission is separate from user management', () => {
    assert.equal(canAccess('admin', 'reports.activity.view'), true);
    assert.equal(canAccess('sales', 'reports.activity.view'), false);
    assert.equal(canAccess('viewer', 'reports.activity.view'), false);
});

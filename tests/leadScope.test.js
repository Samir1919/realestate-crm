const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { __testables } = require('../controllers/leadController');

function buildReq(role, id) {
    return {
        session: {
            user: {
                role,
                id
            }
        }
    };
}

test('sales role is scoped to assigned user id', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const query = __testables.buildLeadScopeQuery(buildReq('sales', userId));

    assert.equal(String(query.assignedUser), userId);
});

test('admin role is not scoped by assigned user id', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const query = __testables.buildLeadScopeQuery(buildReq('admin', userId));

    assert.deepEqual(query, {});
});

test('sales role without valid id has no scope query', () => {
    const query = __testables.buildLeadScopeQuery(buildReq('sales', 'invalid-id'));

    assert.deepEqual(query, {});
});

test('lead activity filter defaults to active records including legacy rows', () => {
    assert.equal(__testables.normalizeLeadActivityFilter(undefined), 'active');
    assert.deepEqual(__testables.buildLeadActivityQuery('active'), {
        isActive: { $ne: false }
    });
});

test('lead activity filter can target inactive or all records', () => {
    assert.equal(__testables.normalizeLeadActivityFilter('inactive'), 'inactive');
    assert.equal(__testables.normalizeLeadActivityFilter('all'), 'all');
    assert.deepEqual(__testables.buildLeadActivityQuery('inactive'), { isActive: false });
    assert.deepEqual(__testables.buildLeadActivityQuery('all'), {});
});

test('lead request filter normalizes supported request states', () => {
    assert.equal(__testables.normalizeLeadRequestFilter('pending'), 'pending');
    assert.equal(__testables.normalizeLeadRequestFilter('approved'), 'approved');
    assert.equal(__testables.normalizeLeadRequestFilter('rejected'), 'rejected');
    assert.equal(__testables.normalizeLeadRequestFilter('none'), 'none');
    assert.equal(__testables.normalizeLeadRequestFilter('unknown'), '');
});

test('lead request query builder supports pending and none states', () => {
    assert.deepEqual(__testables.buildLeadRequestQuery('pending'), {
        'inactiveRequest.status': 'pending'
    });
    assert.deepEqual(__testables.buildLeadRequestQuery('none'), {
        $or: [
            { 'inactiveRequest.status': { $exists: false } },
            { 'inactiveRequest.status': null },
            { 'inactiveRequest.status': 'none' }
        ]
    });
});

test('lead form active flag parses boolean-like values safely', () => {
    assert.equal(__testables.parseLeadActiveValue(undefined), true);
    assert.equal(__testables.parseLeadActiveValue('true'), true);
    assert.equal(__testables.parseLeadActiveValue('false'), false);
    assert.equal(__testables.parseLeadActiveValue('inactive'), false);
});

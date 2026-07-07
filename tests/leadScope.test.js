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

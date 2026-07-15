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
    const query = __testables.buildLeadScopeQuery(buildReq('sales', userId), 'view');

    assert.equal(String(query.assignedUser), userId);
});

test('admin role is not scoped by assigned user id', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const query = __testables.buildLeadScopeQuery(buildReq('admin', userId), 'view');

    assert.deepEqual(query, {});
});

test('sales role without valid id is denied for own-scope access', () => {
    const query = __testables.buildLeadScopeQuery(buildReq('sales', 'invalid-id'), 'view');

    assert.equal(query, null);
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

test('lead type filter normalizes supported types', () => {
    assert.equal(__testables.normalizeLeadType('good'), 'good');
    assert.equal(__testables.normalizeLeadType('BAD'), 'bad');
    assert.equal(__testables.normalizeLeadType('spam'), 'spam');
    assert.equal(__testables.normalizeLeadType('unknown'), '');
});

test('lead follow-up filter normalizes supported values', () => {
    assert.equal(__testables.normalizeLeadFollowUpFilter('today'), 'today');
    assert.equal(__testables.normalizeLeadFollowUpFilter('all'), 'all');
    assert.equal(__testables.normalizeLeadFollowUpFilter('unknown'), '');
});

test('lead sort field normalizes and allowlists supported fields', () => {
    assert.equal(__testables.normalizeLeadSortField('createdAt'), 'createdAt');
    assert.equal(__testables.normalizeLeadSortField('followUpDate'), 'followUpDate');
    assert.equal(__testables.normalizeLeadSortField('customerName'), 'customerName');
    assert.equal(__testables.normalizeLeadSortField('unknownField'), '');
});

test('lead sort order normalizes supported values', () => {
    assert.equal(__testables.normalizeLeadSortOrder('asc'), 'asc');
    assert.equal(__testables.normalizeLeadSortOrder('desc'), 'desc');
    assert.equal(__testables.normalizeLeadSortOrder('ascending'), 'asc');
    assert.equal(__testables.normalizeLeadSortOrder('descending'), 'desc');
    assert.equal(__testables.normalizeLeadSortOrder('acceding'), 'asc');
    assert.equal(__testables.normalizeLeadSortOrder('deccending'), 'desc');
    assert.equal(__testables.normalizeLeadSortOrder('unknown'), '');
});

test('lead type query builder keeps legacy rows inside good filter', () => {
    assert.deepEqual(__testables.buildLeadTypeQuery('good'), {
        $or: [
            { leadType: 'good' },
            { leadType: { $exists: false } },
            { leadType: null }
        ]
    });
    assert.deepEqual(__testables.buildLeadTypeQuery('spam'), { leadType: 'spam' });
});

test('lead follow-up query builder supports today filter', () => {
    const query = __testables.buildLeadFollowUpQuery('today');

    assert.ok(query.followUpDate);
    assert.ok(query.followUpDate.$gte instanceof Date);
    assert.ok(query.followUpDate.$lte instanceof Date);
});

test('lead follow-up query builder supports all follow-ups', () => {
    assert.deepEqual(__testables.buildLeadFollowUpQuery('all'), {
        followUpDate: {
            $exists: true,
            $ne: null
        }
    });
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

test('lead id normalization keeps only valid object ids', () => {
    const validIdA = new mongoose.Types.ObjectId().toString();
    const validIdB = new mongoose.Types.ObjectId().toString();

    const normalized = __testables.normalizeLeadIds([
        validIdA,
        'invalid-id',
        ` ${validIdB} `,
        ''
    ]);

    assert.deepEqual(normalized, [validIdA, validIdB]);
});

test('lead list filters can include lead type', () => {
    const query = __testables.applyLeadListFilters({}, {
        q: '',
        status: '',
        leadType: 'spam',
        source: '',
        priority: '',
        assignedUser: '',
        propertyType: '',
        activity: 'active',
        requestState: ''
    });

    assert.deepEqual(query.isActive, { $ne: false });
    assert.deepEqual(query.$and, [{ leadType: 'spam' }]);
});

test('good lead type filter includes rows without explicit leadType', () => {
    const query = __testables.applyLeadListFilters({}, {
        q: '',
        status: '',
        leadType: 'good',
        followUp: '',
        source: '',
        priority: '',
        assignedUser: '',
        propertyType: '',
        activity: 'active',
        requestState: ''
    });

    assert.deepEqual(query.$and, [{
        $or: [
            { leadType: 'good' },
            { leadType: { $exists: false } },
            { leadType: null }
        ]
    }]);
});

test('lead list filters can include today follow-up condition', () => {
    const query = __testables.applyLeadListFilters({}, {
        q: '',
        status: '',
        leadType: '',
        followUp: 'today',
        source: '',
        priority: '',
        assignedUser: '',
        propertyType: '',
        activity: 'active',
        requestState: ''
    });

    assert.equal(query.$and.length, 1);
    assert.ok(query.$and[0].followUpDate);
});

test('lead list filters can include all follow-up condition', () => {
    const query = __testables.applyLeadListFilters({}, {
        q: '',
        status: '',
        leadType: '',
        followUp: 'all',
        source: '',
        priority: '',
        assignedUser: '',
        propertyType: '',
        activity: 'active',
        requestState: ''
    });

    assert.equal(query.$and.length, 1);
    assert.deepEqual(query.$and[0], {
        followUpDate: {
            $exists: true,
            $ne: null
        }
    });
});

test('lead list sort switches to follow-up date for follow-up filters', () => {
    assert.deepEqual(__testables.buildLeadListSort({ followUp: '' }), { createdAt: -1 });
    assert.deepEqual(__testables.buildLeadListSort({ followUp: 'today' }), {
        followUpDate: 1,
        updatedAt: -1,
        createdAt: -1
    });
    assert.deepEqual(__testables.buildLeadListSort({ followUp: 'all' }), {
        followUpDate: 1,
        updatedAt: -1,
        createdAt: -1
    });
    assert.deepEqual(__testables.buildLeadListSort({ followUp: 'all', sortOrder: 'desc' }), {
        followUpDate: -1,
        updatedAt: -1,
        createdAt: -1
    });
});

test('lead list sort supports explicit sortBy and sortOrder', () => {
    assert.deepEqual(__testables.buildLeadListSort({ sortBy: 'customerName', sortOrder: 'asc' }), {
        customerName: 1,
        updatedAt: -1,
        createdAt: -1
    });
    assert.deepEqual(__testables.buildLeadListSort({ sortBy: 'updatedAt', sortOrder: 'desc' }), {
        updatedAt: -1,
        createdAt: -1
    });
});

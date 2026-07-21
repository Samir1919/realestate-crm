const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildActivityTrend,
    buildDailyActivitySummary,
    createActivitySummaryCsv,
    describeActivityEvent,
    getActivityPresetRange,
    getDhakaDateRange,
    getDhakaDayRange,
    includeSummaryByActivityFilters,
    isMeaningfulEvent,
    normalizeActivityReportFilters,
    scoreActivityEvent
} = require('../utils/activityReport');

test('daily activity summary groups lead work by actor and unique touched leads', () => {
    const summaries = buildDailyActivitySummary([
        {
            action: 'leads.create',
            actorId: 'user-1',
            actorEmail: 'sales@example.com',
            actorRole: 'sales',
            targetId: 'lead-1',
            metadata: {}
        },
        {
            action: 'leads.update',
            actorId: 'user-1',
            actorEmail: 'sales@example.com',
            actorRole: 'sales',
            targetId: 'lead-1',
            metadata: { changedFields: ['status', 'followUpDate'] }
        },
        {
            action: 'leads.bulk_assign',
            actorId: 'user-2',
            actorEmail: 'admin@example.com',
            actorRole: 'admin',
            targetId: '',
            metadata: { leadIds: ['lead-2', 'lead-3'], leadCount: 2 }
        }
    ]);

    assert.equal(summaries.length, 2);
    assert.equal(summaries[0].actorEmail, 'sales@example.com');
    assert.equal(summaries[0].totalActions, 2);
    assert.equal(summaries[0].uniqueLeadsTouched, 1);
    assert.equal(summaries[0].meaningfulActions, 2);
    assert.equal(summaries[0].score, 8);
    assert.equal(summaries[1].uniqueLeadsTouched, 2);
});

test('plain lead detail edits are low-value but still counted', () => {
    const event = {
        action: 'leads.update',
        metadata: { changedFields: ['preferredLocation'] }
    };

    assert.equal(isMeaningfulEvent(event), false);
    assert.equal(scoreActivityEvent(event), 1);
});

test('activity descriptions explain changed values and bulk assignments', () => {
    const userNames = new Map([['user-2', 'Demo Employee']]);
    const updateDescription = describeActivityEvent({
        action: 'leads.update',
        metadata: {
            changedFields: ['status', 'followUpDate'],
            fieldChanges: {
                status: { from: 'New', to: 'Interested' },
                followUpDate: { from: '', to: '2026-07-22' }
            }
        }
    }, userNames);
    const bulkDescription = describeActivityEvent({
        action: 'leads.bulk_assign',
        metadata: { leadCount: 3, assignedUser: 'user-2' }
    }, userNames);

    assert.match(updateDescription, /status: New → Interested/);
    assert.match(updateDescription, /follow-up date: None → 22\/07\/2026/);
    assert.equal(bulkDescription, '3 leads assigned to Demo Employee');
});

test('Dhaka report day range uses UTC bounds for the selected local date', () => {
    const range = getDhakaDayRange('2026-07-19');

    assert.equal(range.date, '2026-07-19');
    assert.equal(range.start.toISOString(), '2026-07-18T18:00:00.000Z');
    assert.equal(range.end.toISOString(), '2026-07-19T18:00:00.000Z');
});

test('activity report filters normalize ranges, actions, and thresholds', () => {
    const filters = normalizeActivityReportFilters({
        startDate: '2026-07-21',
        endDate: '2026-07-19',
        userId: ' user-1 ',
        role: ' Sales ',
        action: 'leads.update',
        minScore: '5.8',
        minMeaningful: '-2'
    });

    assert.equal(filters.startDate, '2026-07-19');
    assert.equal(filters.endDate, '2026-07-21');
    assert.equal(filters.userId, 'user-1');
    assert.equal(filters.role, 'sales');
    assert.equal(filters.action, 'leads.update');
    assert.equal(filters.minScore, 5);
    assert.equal(filters.minMeaningful, 0);
});

test('activity report date range includes the full selected end date in Dhaka time', () => {
    const range = getDhakaDateRange('2026-07-19', '2026-07-21');

    assert.equal(range.startDate, '2026-07-19');
    assert.equal(range.endDate, '2026-07-21');
    assert.equal(range.start.toISOString(), '2026-07-18T18:00:00.000Z');
    assert.equal(range.end.toISOString(), '2026-07-21T18:00:00.000Z');
});

test('activity preset ranges build today, seven day, and thirty day windows', () => {
    const fixedNow = new Date('2026-07-19T10:00:00.000Z');

    assert.deepEqual(getActivityPresetRange('today', fixedNow), {
        startDate: '2026-07-19',
        endDate: '2026-07-19'
    });
    assert.deepEqual(getActivityPresetRange('7d', fixedNow), {
        startDate: '2026-07-13',
        endDate: '2026-07-19'
    });
    assert.deepEqual(getActivityPresetRange('30d', fixedNow), {
        startDate: '2026-06-20',
        endDate: '2026-07-19'
    });
});

test('low activity filter treats minimum values as targets', () => {
    const summary = {
        score: 2,
        meaningfulActions: 0
    };

    assert.equal(includeSummaryByActivityFilters(summary, {
        lowActivityOnly: true,
        minScore: 3,
        minMeaningful: 1
    }), true);
    assert.equal(includeSummaryByActivityFilters(summary, {
        lowActivityOnly: false,
        minScore: 3,
        minMeaningful: 0
    }), false);
});

test('activity trend keeps empty days and scores daily lead activity', () => {
    const trend = buildActivityTrend([
        {
            action: 'leads.create',
            createdAt: new Date('2026-07-18T18:30:00.000Z'),
            targetId: 'lead-1',
            metadata: {}
        }
    ], {
        startDate: '2026-07-19',
        endDate: '2026-07-20'
    });

    assert.equal(trend.length, 2);
    assert.equal(trend[0].date, '2026-07-19');
    assert.equal(trend[0].score, 3);
    assert.equal(trend[0].uniqueLeadsTouched, 1);
    assert.equal(trend[1].date, '2026-07-20');
    assert.equal(trend[1].score, 0);
});

test('activity CSV export escapes summary values', () => {
    const csv = createActivitySummaryCsv([
        {
            actorEmail: 'sales,one@example.com',
            actorRole: 'sales',
            totalActions: 2,
            uniqueLeadsTouched: 1,
            meaningfulActions: 1,
            score: 3
        }
    ]);

    assert.match(csv, /^User,Role,Actions,Unique Leads,Meaningful Actions,Score\n/);
    assert.match(csv, /"sales,one@example.com",sales,2,1,1,3/);
});

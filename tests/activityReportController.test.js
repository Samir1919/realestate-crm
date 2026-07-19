const test = require('node:test');
const assert = require('node:assert/strict');
const ejs = require('ejs');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const activityReportController = require('../controllers/activityReportController');

function makeLeanSortChain(rows) {
    return {
        sort() {
            return this;
        },
        lean() {
            return Promise.resolve(rows);
        }
    };
}

function makeUserFindChain(rows) {
    return {
        select() {
            return this;
        },
        sort() {
            return this;
        },
        lean() {
            return Promise.resolve(rows);
        }
    };
}

async function withDemoActivityData(run) {
    const originalAuditFind = AuditLog.find;
    const originalUserFind = User.find;
    const originalUserDistinct = User.distinct;

    const salesUserId = new mongoose.Types.ObjectId();
    const quietUserId = new mongoose.Types.ObjectId();
    const adminUserId = new mongoose.Types.ObjectId();
    const demoUsers = [
        { _id: salesUserId, name: 'Demo Sales Active', email: 'active.sales@example.com', role: 'sales' },
        { _id: quietUserId, name: 'Demo Sales Quiet', email: 'quiet.sales@example.com', role: 'sales' },
        { _id: adminUserId, name: 'Demo Admin', email: 'admin@example.com', role: 'admin' }
    ];
    const demoEvents = [
        {
            action: 'leads.create',
            actorId: salesUserId,
            actorEmail: 'active.sales@example.com',
            actorRole: 'sales',
            targetType: 'lead',
            targetId: 'lead-1',
            success: true,
            metadata: {},
            createdAt: new Date('2026-07-18T18:10:00.000Z')
        },
        {
            action: 'leads.update',
            actorId: salesUserId,
            actorEmail: 'active.sales@example.com',
            actorRole: 'sales',
            targetType: 'lead',
            targetId: 'lead-1',
            success: true,
            metadata: { changedFields: ['status', 'followUpDate'] },
            createdAt: new Date('2026-07-18T19:00:00.000Z')
        },
        {
            action: 'leads.bulk_assign',
            actorId: adminUserId,
            actorEmail: 'admin@example.com',
            actorRole: 'admin',
            targetType: 'lead',
            targetId: '',
            success: true,
            metadata: { leadIds: ['lead-2', 'lead-3'], leadCount: 2 },
            createdAt: new Date('2026-07-19T08:00:00.000Z')
        }
    ];

    let lastAuditQuery = null;
    AuditLog.find = (query) => {
        lastAuditQuery = query;
        const filteredEvents = demoEvents.filter((event) => {
            const actions = Array.isArray(query.action?.$in) ? query.action.$in : [query.action];
            const actionMatches = actions.includes(event.action);
            const roleMatches = !query.actorRole || event.actorRole === query.actorRole;
            const actorMatches = !query.actorId || String(event.actorId) === String(query.actorId);
            const createdAtMatches = event.createdAt >= query.createdAt.$gte && event.createdAt < query.createdAt.$lt;
            return actionMatches && roleMatches && actorMatches && createdAtMatches && event.success === query.success;
        });
        return makeLeanSortChain(filteredEvents);
    };
    User.find = () => makeUserFindChain(demoUsers);
    User.distinct = async () => ['sales', 'admin'];

    try {
        await run({ salesUserId, quietUserId, adminUserId, getLastAuditQuery: () => lastAuditQuery });
    } finally {
        AuditLog.find = originalAuditFind;
        User.find = originalUserFind;
        User.distinct = originalUserDistinct;
    }
}

test('activity report builds totals from demo users and lead work events', async () => {
    await withDemoActivityData(async () => {
        const report = await activityReportController.__testables.buildActivityReportData({
            startDate: '2026-07-19',
            endDate: '2026-07-19'
        });

        assert.equal(report.summaries.length, 3);
        assert.equal(report.totals.totalActions, 3);
        assert.equal(report.totals.uniqueLeadsTouched, 3);
        assert.equal(report.totals.meaningfulActions, 3);
        assert.equal(report.totals.score, 10);
        assert.equal(report.trend.length, 1);
        assert.equal(report.trend[0].score, 10);

        const activeSales = report.summaries.find((summary) => summary.actorEmail === 'active.sales@example.com');
        const quietSales = report.summaries.find((summary) => summary.actorEmail === 'quiet.sales@example.com');
        assert.equal(activeSales.totalActions, 2);
        assert.equal(activeSales.score, 8);
        assert.equal(quietSales.totalActions, 0);
        assert.equal(quietSales.score, 0);
    });
});

test('activity report filters demo data by user, role, action, and low activity', async () => {
    await withDemoActivityData(async ({ salesUserId }) => {
        const userReport = await activityReportController.__testables.buildActivityReportData({
            startDate: '2026-07-19',
            endDate: '2026-07-19',
            userId: String(salesUserId)
        });
        assert.deepEqual(userReport.summaries.map((summary) => summary.actorEmail), ['active.sales@example.com']);
        assert.equal(userReport.totals.score, 8);

        const actionReport = await activityReportController.__testables.buildActivityReportData({
            startDate: '2026-07-19',
            endDate: '2026-07-19',
            action: 'leads.bulk_assign'
        });
        assert.equal(actionReport.totals.totalActions, 1);
        assert.equal(actionReport.totals.uniqueLeadsTouched, 2);

        const lowActivityReport = await activityReportController.__testables.buildActivityReportData({
            startDate: '2026-07-19',
            endDate: '2026-07-19',
            role: 'sales',
            minScore: '1',
            minMeaningful: '1',
            lowActivityOnly: '1'
        });
        assert.deepEqual(lowActivityReport.summaries.map((summary) => summary.actorEmail), ['quiet.sales@example.com']);
    });
});

test('activity report CSV export returns downloadable demo summary', async () => {
    await withDemoActivityData(async () => {
        const headers = {};
        const res = {
            statusCode: 0,
            body: '',
            setHeader(name, value) {
                headers[name.toLowerCase()] = value;
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
            send(body) {
                this.body = body;
                return this;
            }
        };

        await activityReportController.exportActivityReportCsv({
            query: {
                startDate: '2026-07-19',
                endDate: '2026-07-19'
            }
        }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(headers['content-type'], 'text/csv; charset=utf-8');
        assert.match(headers['content-disposition'], /activity-report-2026-07-19-to-2026-07-19\.csv/);
        assert.match(res.body, /^User,Role,Actions,Unique Leads,Meaningful Actions,Score\n/);
        assert.match(res.body, /active\.sales@example\.com,sales,2,1,2,8/);
        assert.match(res.body, /quiet\.sales@example\.com,sales,0,0,0,0/);
    });
});

test('activity report page renders with demo report data', async () => {
    await withDemoActivityData(async () => {
        const report = await activityReportController.__testables.buildActivityReportData({
            startDate: '2026-07-19',
            endDate: '2026-07-19',
            minScore: '1',
            lowActivityOnly: '1'
        });

        const html = await ejs.renderFile('views/activity-report.ejs', {
            csrfToken: 'test-csrf-token',
            user: { role: 'admin' },
            currentRole: 'admin',
            permissions: {
                viewLeads: true,
                manageUsers: true,
                manageRoles: true
            },
            reportDate: report.filters.startDate,
            ...report
        });

        assert.match(html, /User Activity Report/);
        assert.match(html, /Low activity users only/);
        assert.match(html, /Export CSV/);
        assert.match(html, /Daily Trend/);
        assert.match(html, /quiet\.sales@example\.com/);
    });
});
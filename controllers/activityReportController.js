const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const {
    ACTION_LABELS,
    LEAD_ACTIVITY_ACTIONS,
    buildActivityTrend,
    buildDailyActivitySummary,
    buildEmptyActivitySummary,
    createActivitySummaryCsv,
    getDhakaDateRange,
    includeSummaryByActivityFilters,
    normalizeActivityReportFilters
} = require('../utils/activityReport');

function userMatchesFilters(user, filters) {
    const userId = user?._id ? String(user._id) : '';
    const role = String(user?.role || '').trim().toLowerCase();

    if (filters.userId && userId !== filters.userId) {
        return false;
    }

    if (filters.role && role !== filters.role) {
        return false;
    }

    return true;
}

async function buildActivityReportData(query) {
    const filters = normalizeActivityReportFilters(query);
    const { start, end } = getDhakaDateRange(filters.startDate, filters.endDate);
    const eventQuery = {
        action: { $in: LEAD_ACTIVITY_ACTIONS },
        success: true,
        createdAt: { $gte: start, $lt: end }
    };

    if (filters.action) {
        eventQuery.action = filters.action;
    }

    if (filters.role) {
        eventQuery.actorRole = filters.role;
    }

    if (filters.userId && mongoose.Types.ObjectId.isValid(filters.userId)) {
        eventQuery.actorId = new mongoose.Types.ObjectId(filters.userId);
    }

    const [events, users, roleOptions] = await Promise.all([
        AuditLog.find(eventQuery)
            .sort({ createdAt: -1 })
            .lean(),
        User.find().select('name email role').sort({ name: 1, email: 1 }).lean(),
        User.distinct('role')
    ]);

    const eventSummaries = buildDailyActivitySummary(events);
    const summariesByActorId = new Map();
    eventSummaries.forEach((summary) => {
        if (summary.actorId) {
            summariesByActorId.set(summary.actorId, summary);
        }
    });
    const userIds = new Set(users.map((user) => String(user._id)));

    let summaries = users
        .filter((user) => userMatchesFilters(user, filters))
        .map((user) => summariesByActorId.get(String(user._id)) || buildEmptyActivitySummary(user));

    const eventOnlySummaries = eventSummaries
        .filter((summary) => !summary.actorId || !userIds.has(summary.actorId));
    summaries = summaries.concat(eventOnlySummaries);

    summaries = summaries
        .filter((summary) => includeSummaryByActivityFilters(summary, filters))
        .sort((first, second) => second.score - first.score || second.totalActions - first.totalActions);

    const globalLeadIds = new Set();
    summaries.forEach((summary) => {
        summary.leadIds.forEach((leadId) => globalLeadIds.add(leadId));
    });
    const totals = summaries.reduce((acc, summary) => {
        acc.totalActions += summary.totalActions;
        acc.meaningfulActions += summary.meaningfulActions;
        acc.score += summary.score;
        return acc;
    }, {
        totalActions: 0,
        meaningfulActions: 0,
        uniqueLeadsTouched: globalLeadIds.size,
        score: 0
    });

    return {
        filters,
        summaries,
        totals,
        recentEvents: events.slice(0, 50),
        trend: buildActivityTrend(events, filters),
        actionLabels: ACTION_LABELS,
        actionOptions: LEAD_ACTIVITY_ACTIONS.map((action) => ({
            value: action,
            label: ACTION_LABELS[action] || action
        })),
        users,
        roleOptions: roleOptions
            .map((role) => String(role || '').trim().toLowerCase())
            .filter(Boolean)
            .sort()
    };
}

async function getActivityReport(req, res) {
    try {
        const report = await buildActivityReportData(req.query);

        res.render('activity-report', {
            reportDate: report.filters.startDate,
            ...report
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
}

async function exportActivityReportCsv(req, res) {
    try {
        const report = await buildActivityReportData(req.query);
        const csv = createActivitySummaryCsv(report.summaries);
        const fileLabel = `${report.filters.startDate}-to-${report.filters.endDate}`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="activity-report-${fileLabel}.csv"`);
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).send(err.message);
    }
}

module.exports = {
    getActivityReport,
    exportActivityReportCsv,
    __testables: {
        buildActivityReportData,
        userMatchesFilters
    }
};
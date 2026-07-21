const LEAD_ACTIVITY_ACTIONS = [
    'leads.create',
    'leads.update',
    'leads.note_add',
    'leads.bulk_assign',
    'leads.inactive_request',
    'leads.inactivate',
    'leads.inactive_reject',
    'leads.restore'
];

const ACTION_LABELS = {
    'leads.create': 'Lead Created',
    'leads.update': 'Lead Updated',
    'leads.note_add': 'Note Added',
    'leads.bulk_assign': 'Bulk Assigned',
    'leads.inactive_request': 'Inactive Requested',
    'leads.inactivate': 'Lead Inactivated',
    'leads.inactive_reject': 'Inactive Rejected',
    'leads.restore': 'Lead Restored'
};

const MEANINGFUL_UPDATE_FIELDS = new Set([
    'status',
    'followUpDate',
    'messageNote',
    'priority',
    'leadType',
    'assignedUser'
]);

const ACTIVITY_FIELD_LABELS = {
    assignedUser: 'employee',
    bedrooms: 'bedrooms',
    budgetMax: 'maximum budget',
    budgetMin: 'minimum budget',
    customerName: 'customer name',
    followUpDate: 'follow-up date',
    isActive: 'activity state',
    leadType: 'lead type',
    messageNote: 'latest note',
    phone: 'phone',
    preferredLocation: 'location',
    preferredSize: 'preferred size',
    priority: 'priority',
    propertyType: 'property type',
    purpose: 'purpose',
    source: 'source',
    status: 'status'
};

function formatDhakaDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeReportDate(inputDate) {
    const normalizedDate = String(inputDate || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
        return normalizedDate;
    }

    return formatDhakaDate();
}

function getDhakaDayRange(inputDate) {
    const date = normalizeReportDate(inputDate);
    const start = new Date(`${date}T00:00:00+06:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return { date, start, end };
}

function normalizeMinimumNumber(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return 0;
    }

    return Math.floor(numericValue);
}

function parseBooleanFilter(value) {
    return value === true || value === 'true' || value === '1' || value === 'on';
}

function addDaysToReportDate(reportDate, days) {
    const date = normalizeReportDate(reportDate);
    const start = new Date(`${date}T00:00:00+06:00`);
    return formatDhakaDate(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}

function getActivityPresetRange(preset, currentDate = new Date()) {
    const today = formatDhakaDate(currentDate);

    if (preset === '7d') {
        return {
            startDate: addDaysToReportDate(today, -6),
            endDate: today
        };
    }

    if (preset === '30d') {
        return {
            startDate: addDaysToReportDate(today, -29),
            endDate: today
        };
    }

    return {
        startDate: today,
        endDate: today
    };
}

function normalizeActivityReportFilters(query = {}) {
    const presetRange = query.preset ? getActivityPresetRange(String(query.preset).trim()) : null;
    const fallbackDate = normalizeReportDate(query.date);
    const startDate = normalizeReportDate(query.startDate || presetRange?.startDate || fallbackDate);
    const endDate = normalizeReportDate(query.endDate || presetRange?.endDate || query.startDate || fallbackDate);
    const normalizedStartDate = startDate <= endDate ? startDate : endDate;
    const normalizedEndDate = startDate <= endDate ? endDate : startDate;
    const normalizedAction = String(query.action || '').trim();

    return {
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        userId: String(query.userId || '').trim(),
        role: String(query.role || '').trim().toLowerCase(),
        action: LEAD_ACTIVITY_ACTIONS.includes(normalizedAction) ? normalizedAction : '',
        minScore: normalizeMinimumNumber(query.minScore),
        minMeaningful: normalizeMinimumNumber(query.minMeaningful),
        lowActivityOnly: parseBooleanFilter(query.lowActivityOnly)
    };
}

function getDhakaDateRange(startDateInput, endDateInput) {
    const filters = normalizeActivityReportFilters({
        startDate: startDateInput,
        endDate: endDateInput
    });
    const start = new Date(`${filters.startDate}T00:00:00+06:00`);
    const endStart = new Date(`${filters.endDate}T00:00:00+06:00`);
    const end = new Date(endStart.getTime() + 24 * 60 * 60 * 1000);

    return {
        startDate: filters.startDate,
        endDate: filters.endDate,
        start,
        end
    };
}

function getEventLeadIds(event) {
    const ids = new Set();
    const targetId = String(event.targetId || '').trim();
    if (targetId) {
        ids.add(targetId);
    }

    const metadataLeadIds = Array.isArray(event.metadata?.leadIds) ? event.metadata.leadIds : [];
    metadataLeadIds.forEach((leadId) => {
        const normalizedLeadId = String(leadId || '').trim();
        if (normalizedLeadId) {
            ids.add(normalizedLeadId);
        }
    });

    return ids;
}

function humanizeActivityField(fieldName) {
    const normalizedField = String(fieldName || '').trim();
    if (ACTIVITY_FIELD_LABELS[normalizedField]) {
        return ACTIVITY_FIELD_LABELS[normalizedField];
    }

    return normalizedField
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase();
}

function formatActivityFollowUpDate(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
}

function formatActivityChangeValue(fieldName, value, userNamesById) {
    if (value === '' || value === null || value === undefined) return 'None';
    if (fieldName === 'assignedUser') return userNamesById.get(String(value)) || 'Unknown employee';
    if (fieldName === 'followUpDate') return formatActivityFollowUpDate(value) || 'None';
    if (fieldName === 'isActive') return String(value) === 'true' ? 'Active' : 'Inactive';
    return String(value);
}

function describeActivityEvent(event, userNamesById = new Map()) {
    const metadata = event?.metadata || {};
    const assignedUserId = String(metadata.assignedUser || '').trim();
    const assignedUserName = assignedUserId ? (userNamesById.get(assignedUserId) || 'Unknown employee') : 'Unassigned';

    if (event.action === 'leads.create') {
        const details = [];
        if (metadata.status) details.push(`Status: ${metadata.status}`);
        if (metadata.leadType) details.push(`Type: ${String(metadata.leadType).toUpperCase()}`);
        if (assignedUserId) details.push(`Employee: ${assignedUserName}`);
        return details.length ? details.join(' · ') : 'Lead created';
    }

    if (event.action === 'leads.update') {
        const changedFields = Array.isArray(metadata.changedFields) ? metadata.changedFields : [];
        const fieldLabels = changedFields.map(humanizeActivityField).filter(Boolean);
        const details = fieldLabels.length ? `${fieldLabels.join(', ')} updated` : 'Lead details updated';
        const fieldChanges = metadata.fieldChanges && typeof metadata.fieldChanges === 'object'
            ? metadata.fieldChanges
            : {};
        const changeDescriptions = Object.entries(fieldChanges).map(([fieldName, change]) => {
            const from = formatActivityChangeValue(fieldName, change?.from, userNamesById);
            const to = formatActivityChangeValue(fieldName, change?.to, userNamesById);
            return `${humanizeActivityField(fieldName)}: ${from} → ${to}`;
        });
        if (changeDescriptions.length) return `${details} · ${changeDescriptions.join(' · ')}`;
        const values = [];
        if (changedFields.includes('status') && metadata.status) values.push(`Status: ${metadata.status}`);
        const followUpDate = changedFields.includes('followUpDate')
            ? formatActivityFollowUpDate(metadata.followUpDate)
            : '';
        if (followUpDate) values.push(`Follow-up: ${followUpDate}`);
        return values.length ? `${details} · ${values.join(' · ')}` : details;
    }

    if (event.action === 'leads.note_add') {
        const activityType = String(metadata.activityType || '').trim();
        return activityType ? `${activityType} note added` : 'Timeline note added';
    }

    if (event.action === 'leads.bulk_assign') {
        const leadCount = Math.max(0, Number(metadata.leadCount || 0));
        return `${leadCount} ${leadCount === 1 ? 'lead' : 'leads'} assigned to ${assignedUserName}`;
    }

    if (event.action === 'leads.inactive_request') return 'Inactive request submitted for review';
    if (event.action === 'leads.inactivate') {
        return metadata.approvedInactiveRequest
            ? 'Inactive request approved and lead inactivated'
            : 'Lead inactivated directly';
    }
    if (event.action === 'leads.inactive_reject') return 'Inactive request rejected';
    if (event.action === 'leads.restore') return 'Lead restored to active';

    return ACTION_LABELS[event.action] || String(event.action || 'Activity recorded');
}

function isMeaningfulEvent(event) {
    if (event.action !== 'leads.update') {
        return true;
    }

    const changedFields = Array.isArray(event.metadata?.changedFields) ? event.metadata.changedFields : [];
    return changedFields.some((fieldName) => MEANINGFUL_UPDATE_FIELDS.has(fieldName));
}

function scoreActivityEvent(event) {
    if (event.action === 'leads.create') {
        return 3;
    }

    if (event.action === 'leads.note_add') {
        return 2;
    }

    if (event.action === 'leads.bulk_assign') {
        return Math.max(1, Number(event.metadata?.leadCount || 0));
    }

    if (event.action === 'leads.inactive_request' || event.action === 'leads.inactivate' || event.action === 'leads.restore') {
        return 2;
    }

    if (event.action === 'leads.update') {
        const changedFields = new Set(Array.isArray(event.metadata?.changedFields) ? event.metadata.changedFields : []);
        let score = 0;
        if (changedFields.has('status')) score += 3;
        if (changedFields.has('followUpDate')) score += 2;
        if (changedFields.has('messageNote')) score += 2;
        if (changedFields.has('priority') || changedFields.has('leadType')) score += 1;
        return score || 1;
    }

    return 1;
}

function buildDailyActivitySummary(events) {
    const summariesByActor = new Map();

    events.forEach((event) => {
        const actorKey = String(event.actorId || event.actorEmail || 'unknown');
        if (!summariesByActor.has(actorKey)) {
            summariesByActor.set(actorKey, {
                actorId: event.actorId ? String(event.actorId) : '',
                actorEmail: event.actorEmail || 'unknown',
                actorRole: event.actorRole || '',
                totalActions: 0,
                meaningfulActions: 0,
                score: 0,
                leadIds: new Set(),
                actionCounts: LEAD_ACTIVITY_ACTIONS.reduce((acc, action) => {
                    acc[action] = 0;
                    return acc;
                }, {})
            });
        }

        const summary = summariesByActor.get(actorKey);
        summary.totalActions += 1;
        summary.actionCounts[event.action] = (summary.actionCounts[event.action] || 0) + 1;
        getEventLeadIds(event).forEach((leadId) => summary.leadIds.add(leadId));

        if (isMeaningfulEvent(event)) {
            summary.meaningfulActions += 1;
        }

        summary.score += scoreActivityEvent(event);
    });

    return Array.from(summariesByActor.values())
        .map((summary) => ({
            ...summary,
            uniqueLeadsTouched: summary.leadIds.size,
            leadIds: Array.from(summary.leadIds)
        }))
        .sort((first, second) => second.score - first.score || second.totalActions - first.totalActions);
}

function buildEmptyActivitySummary(user) {
    return {
        actorId: user?._id ? String(user._id) : '',
        actorEmail: user?.email || 'unknown',
        actorRole: user?.role || '',
        totalActions: 0,
        meaningfulActions: 0,
        score: 0,
        leadIds: [],
        uniqueLeadsTouched: 0,
        actionCounts: LEAD_ACTIVITY_ACTIONS.reduce((acc, action) => {
            acc[action] = 0;
            return acc;
        }, {})
    };
}

function includeSummaryByActivityFilters(summary, filters) {
    if (filters.lowActivityOnly) {
        const scoreTarget = filters.minScore || 1;
        const meaningfulTarget = filters.minMeaningful || 1;
        return summary.score < scoreTarget || summary.meaningfulActions < meaningfulTarget;
    }

    if (filters.minScore && summary.score < filters.minScore) {
        return false;
    }

    if (filters.minMeaningful && summary.meaningfulActions < filters.minMeaningful) {
        return false;
    }

    return true;
}

function getEventDhakaDate(event) {
    return formatDhakaDate(new Date(event.createdAt));
}

function buildActivityTrend(events, filters) {
    const trendByDate = new Map();
    let currentDate = filters.startDate;

    while (currentDate <= filters.endDate) {
        trendByDate.set(currentDate, {
            date: currentDate,
            totalActions: 0,
            meaningfulActions: 0,
            score: 0,
            leadIds: new Set()
        });
        currentDate = addDaysToReportDate(currentDate, 1);
    }

    events.forEach((event) => {
        const eventDate = getEventDhakaDate(event);
        const trend = trendByDate.get(eventDate);
        if (!trend) {
            return;
        }

        trend.totalActions += 1;
        if (isMeaningfulEvent(event)) {
            trend.meaningfulActions += 1;
        }
        trend.score += scoreActivityEvent(event);
        getEventLeadIds(event).forEach((leadId) => trend.leadIds.add(leadId));
    });

    return Array.from(trendByDate.values()).map((trend) => ({
        ...trend,
        uniqueLeadsTouched: trend.leadIds.size,
        leadIds: Array.from(trend.leadIds)
    }));
}

function escapeCsvValue(value) {
    const normalizedValue = String(value ?? '');
    if (!/[",\n\r]/.test(normalizedValue)) {
        return normalizedValue;
    }

    return `"${normalizedValue.replace(/"/g, '""')}"`;
}

function createActivitySummaryCsv(summaries) {
    const headers = ['User', 'Role', 'Actions', 'Unique Leads', 'Meaningful Actions', 'Score'];
    const rows = summaries.map((summary) => [
        summary.actorEmail,
        summary.actorRole || '',
        summary.totalActions,
        summary.uniqueLeadsTouched,
        summary.meaningfulActions,
        summary.score
    ]);

    return [headers, ...rows]
        .map((row) => row.map(escapeCsvValue).join(','))
        .join('\n');
}

module.exports = {
    LEAD_ACTIVITY_ACTIONS,
    ACTION_LABELS,
    addDaysToReportDate,
    buildActivityTrend,
    buildDailyActivitySummary,
    buildEmptyActivitySummary,
    createActivitySummaryCsv,
    describeActivityEvent,
    formatDhakaDate,
    getActivityPresetRange,
    getDhakaDateRange,
    getDhakaDayRange,
    includeSummaryByActivityFilters,
    normalizeActivityReportFilters,
    normalizeReportDate,
    scoreActivityEvent,
    isMeaningfulEvent
};

const mongoose = require('mongoose');

const LEAD_SORT_FIELD_MAP = Object.freeze({
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    followUpDate: 'followUpDate',
    customerName: 'customerName',
    status: 'status',
    priority: 'priority'
});

function normalizeLeadActivityFilter(value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'inactive') {
        return 'inactive';
    }

    if (normalized === 'all') {
        return 'all';
    }

    return 'active';
}

function normalizeLeadRequestFilter(value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected' || normalized === 'none') {
        return normalized;
    }

    return '';
}

function normalizeLeadType(value, fallback = '') {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'good' || normalized === 'bad' || normalized === 'spam') {
        return normalized;
    }

    return fallback;
}

function normalizeLeadFollowUpFilter(value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'today') {
        return 'today';
    }

    if (normalized === 'all') {
        return 'all';
    }

    return '';
}

function normalizeLeadSortOrder(value) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'desc' || normalized === 'descending' || normalized === 'deccending') {
        return 'desc';
    }

    if (normalized === 'asc' || normalized === 'ascending' || normalized === 'acceding') {
        return 'asc';
    }

    return '';
}

function normalizeLeadSortField(value) {
    const normalized = String(value || '').trim();

    if (!normalized) {
        return '';
    }

    return LEAD_SORT_FIELD_MAP[normalized] ? normalized : '';
}

function buildLeadTypeQuery(leadType) {
    if (leadType === 'good') {
        return {
            $or: [
                { leadType: 'good' },
                { leadType: { $exists: false } },
                { leadType: null }
            ]
        };
    }

    if (leadType === 'bad' || leadType === 'spam') {
        return { leadType };
    }

    return {};
}

function buildLeadFollowUpQuery(followUp) {
    if (followUp !== 'today') {
        if (followUp === 'all') {
            return {
                followUpDate: {
                    $exists: true,
                    $ne: null
                }
            };
        }

        return {};
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    return {
        followUpDate: {
            $gte: startOfToday,
            $lte: endOfToday
        }
    };
}

function buildLeadListSort(filters) {
    const sortBy = normalizeLeadSortField(filters.sortBy);
    const sortOrder = normalizeLeadSortOrder(filters.sortOrder);

    if (sortBy) {
        const direction = sortOrder === 'asc' ? 1 : -1;
        const sort = {
            [sortBy]: direction
        };

        if (sortBy !== 'updatedAt') {
            sort.updatedAt = -1;
        }

        if (sortBy !== 'createdAt') {
            sort.createdAt = -1;
        }

        return sort;
    }

    if (filters.followUp === 'today' || filters.followUp === 'all') {
        const followUpSort = sortOrder === 'desc' ? -1 : 1;

        return {
            followUpDate: followUpSort,
            updatedAt: -1,
            createdAt: -1
        };
    }

    return { createdAt: -1 };
}

function buildLeadActivityQuery(activity) {
    if (activity === 'inactive') {
        return { isActive: false };
    }

    if (activity === 'all') {
        return {};
    }

    return { isActive: { $ne: false } };
}

function parseLeadActiveValue(value) {
    const normalized = String(value === undefined ? 'true' : value).trim().toLowerCase();
    return normalized !== 'false' && normalized !== '0' && normalized !== 'inactive';
}

function normalizeLeadIds(value) {
    const values = Array.isArray(value) ? value : [value];

    return values
        .map((item) => String(item || '').trim())
        .filter((item) => mongoose.Types.ObjectId.isValid(item));
}

function buildLeadRequestQuery(requestState) {
    if (requestState === 'pending' || requestState === 'approved' || requestState === 'rejected') {
        return { 'inactiveRequest.status': requestState };
    }

    if (requestState === 'none') {
        return {
            $or: [
                { 'inactiveRequest.status': { $exists: false } },
                { 'inactiveRequest.status': null },
                { 'inactiveRequest.status': 'none' }
            ]
        };
    }

    return {};
}

function appendAndCondition(query, condition) {
    if (!condition || Object.keys(condition).length === 0) {
        return;
    }

    if (!query.$and) {
        query.$and = [];
    }

    query.$and.push(condition);
}

function withAdditionalCondition(baseQuery, condition) {
    const query = {
        ...baseQuery
    };

    if (baseQuery.$and) {
        query.$and = [...baseQuery.$and];
    }

    appendAndCondition(query, condition);
    return query;
}

function getLeadListFilters(req) {
    return {
        q: (req.query.q || '').trim(),
        status: (req.query.status || '').trim(),
        leadType: normalizeLeadType(req.query.leadType),
        followUp: normalizeLeadFollowUpFilter(req.query.followUp),
        sortBy: normalizeLeadSortField(req.query.sortBy),
        sortOrder: normalizeLeadSortOrder(req.query.sortOrder),
        source: (req.query.source || '').trim(),
        priority: (req.query.priority || '').trim(),
        assignedUser: (req.query.assignedUser || '').trim(),
        propertyType: (req.query.propertyType || '').trim(),
        activity: normalizeLeadActivityFilter(req.query.activity),
        requestState: normalizeLeadRequestFilter(req.query.requestState)
    };
}

function applyLeadListFilters(baseQuery, filters) {
    const query = {
        ...baseQuery,
        ...buildLeadActivityQuery(filters.activity)
    };

    if (filters.q) {
        const regex = new RegExp(filters.q, 'i');
        query.$or = [
            { customerName: regex },
            { phone: regex },
            { preferredLocation: regex }
        ];
    }

    if (filters.status) query.status = filters.status;
    if (filters.source) query.source = filters.source;
    if (filters.priority) query.priority = filters.priority;
    if (filters.propertyType) query.propertyType = filters.propertyType;
    if (filters.assignedUser && mongoose.Types.ObjectId.isValid(filters.assignedUser)) {
        query.assignedUser = filters.assignedUser;
    }

    appendAndCondition(query, buildLeadTypeQuery(filters.leadType));
    appendAndCondition(query, buildLeadRequestQuery(filters.requestState));
    appendAndCondition(query, buildLeadFollowUpQuery(filters.followUp));

    return query;
}

function buildLeadsVersion(filteredTotal, latestLead) {
    const countPart = Number.isFinite(filteredTotal) ? filteredTotal : 0;
    const updatedAtPart = latestLead && latestLead.updatedAt
        ? new Date(latestLead.updatedAt).getTime()
        : 0;
    const idPart = latestLead && latestLead._id ? String(latestLead._id) : 'none';

    return `${countPart}:${updatedAtPart}:${idPart}`;
}

module.exports = {
    normalizeLeadActivityFilter,
    normalizeLeadRequestFilter,
    normalizeLeadType,
    normalizeLeadFollowUpFilter,
    normalizeLeadSortOrder,
    normalizeLeadSortField,
    buildLeadTypeQuery,
    buildLeadFollowUpQuery,
    buildLeadListSort,
    buildLeadActivityQuery,
    parseLeadActiveValue,
    normalizeLeadIds,
    buildLeadRequestQuery,
    withAdditionalCondition,
    getLeadListFilters,
    applyLeadListFilters,
    buildLeadsVersion
};

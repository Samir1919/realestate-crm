function parseLeadPagination(query) {
    const parsedPage = Number.parseInt(query.page || '1', 10);
    const page = Number.isNaN(parsedPage) ? 1 : parsedPage;

    const pageSizeOptions = [10, 25, 50];
    const parsedLimit = Number.parseInt(query.limit || '10', 10);
    const limit = pageSizeOptions.includes(parsedLimit) ? parsedLimit : 10;

    return {
        page,
        limit,
        pageSizeOptions
    };
}

function buildPreservedLeadQueryParams(filters, limit) {
    const queryParams = new URLSearchParams();

    if (filters.q) queryParams.set('q', filters.q);
    if (filters.status) queryParams.set('status', filters.status);
    if (filters.leadType) queryParams.set('leadType', filters.leadType);
    if (filters.followUp) queryParams.set('followUp', filters.followUp);
    if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.set('sortOrder', filters.sortOrder);
    if (filters.source) queryParams.set('source', filters.source);
    if (filters.priority) queryParams.set('priority', filters.priority);
    if (filters.assignedUser) queryParams.set('assignedUser', filters.assignedUser);
    if (filters.propertyType) queryParams.set('propertyType', filters.propertyType);
    if (filters.activity !== 'active') queryParams.set('activity', filters.activity);
    if (filters.requestState) queryParams.set('requestState', filters.requestState);
    if (limit !== 10) queryParams.set('limit', String(limit));

    return queryParams;
}

function buildImportSummary(query) {
    return {
        imported: Number.parseInt(query.imported || '0', 10) || 0,
        updated: Number.parseInt(query.updated || '0', 10) || 0,
        skipped: Number.parseInt(query.skipped || '0', 10) || 0,
        hasResult: Object.prototype.hasOwnProperty.call(query, 'imported')
    };
}

async function fetchLeadListingData({
    Lead,
    User,
    scopeQuery,
    query,
    filters,
    page,
    limit,
    buildLeadActivityQuery,
    withAdditionalCondition,
    buildLeadFollowUpQuery,
    buildLeadTypeQuery,
    buildLeadListSort
}) {
    const totalLeads = await Lead.countDocuments(scopeQuery);
    const filteredTotal = await Lead.countDocuments(query);

    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const skip = (currentPage - 1) * limit;

    const users = await User.find()
        .select('name email role')
        .sort({ name: 1 });

    const [activeLeadsCount, inactiveLeadsCount, hotLeadsCount, newLeadsCount, todayFollowUpsCount, goodLeadsCount, badLeadsCount, spamLeadsCount] = await Promise.all([
        Lead.countDocuments({
            ...scopeQuery,
            ...buildLeadActivityQuery('active')
        }),
        Lead.countDocuments({
            ...scopeQuery,
            ...buildLeadActivityQuery('inactive')
        }),
        Lead.countDocuments({ ...query, priority: 'Hot' }),
        Lead.countDocuments({ ...query, status: 'New' }),
        Lead.countDocuments(withAdditionalCondition(query, buildLeadFollowUpQuery('today'))),
        Lead.countDocuments(withAdditionalCondition(query, buildLeadTypeQuery('good'))),
        Lead.countDocuments(withAdditionalCondition(query, buildLeadTypeQuery('bad'))),
        Lead.countDocuments(withAdditionalCondition(query, buildLeadTypeQuery('spam')))
    ]);

    const leads = await Lead.find()
        .find(query)
        .populate('assignedUser', 'name email')
        .sort(buildLeadListSort(filters))
        .skip(skip)
        .limit(limit);

    const pendingInactiveRequestsCount = await Lead.countDocuments({
        ...scopeQuery,
        ...buildLeadActivityQuery('active'),
        'inactiveRequest.status': 'pending'
    });

    const latestLeadForVersion = await Lead.findOne(query)
        .select('updatedAt _id')
        .sort({ updatedAt: -1, _id: -1 })
        .lean();

    return {
        leads,
        users,
        totalLeads,
        filteredTotal,
        totalPages,
        currentPage,
        latestLeadForVersion,
        stats: {
            activeLeadsCount,
            inactiveLeadsCount,
            pendingInactiveRequestsCount,
            hotLeadsCount,
            newLeadsCount,
            todayFollowUpsCount,
            goodLeadsCount,
            badLeadsCount,
            spamLeadsCount
        }
    };
}

module.exports = {
    parseLeadPagination,
    buildPreservedLeadQueryParams,
    buildImportSummary,
    fetchLeadListingData
};

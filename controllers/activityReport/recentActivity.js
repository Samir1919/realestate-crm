const mongoose = require('mongoose');
const Lead = require('../../models/Lead');
const { describeActivityEvent } = require('../../utils/activityReport');

const RECENT_ACTIVITY_PAGE_SIZE = 25;

function normalizeActivityPage(value) {
    const page = Number.parseInt(value || '1', 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

function getEventLeadIds(event) {
    const leadIds = new Set();
    const targetId = String(event?.targetId || '').trim();
    if (targetId) leadIds.add(targetId);

    const bulkLeadIds = Array.isArray(event?.metadata?.leadIds) ? event.metadata.leadIds : [];
    bulkLeadIds.forEach((leadId) => {
        const normalizedLeadId = String(leadId || '').trim();
        if (normalizedLeadId) leadIds.add(normalizedLeadId);
    });

    return Array.from(leadIds);
}

function buildLeadActivityIdentity(lead, fallbackId = '') {
    if (!lead) {
        return {
            id: String(fallbackId || ''),
            referenceNumber: '',
            customerName: '',
            phone: '',
            available: false
        };
    }

    return {
        id: String(lead._id),
        referenceNumber: lead.referenceNumber || '',
        customerName: lead.customerName || '',
        phone: lead.phone || '',
        available: true
    };
}

async function enrichRecentActivityEvents(events, users) {
    const userNamesById = new Map(users.map((user) => [String(user._id), user.name || user.email || 'Unknown user']));
    const leadIds = new Set();
    events.forEach((event) => getEventLeadIds(event).forEach((leadId) => leadIds.add(leadId)));
    const validLeadIds = Array.from(leadIds).filter((leadId) => mongoose.Types.ObjectId.isValid(leadId));
    const leads = validLeadIds.length
        ? await Lead.find({ _id: { $in: validLeadIds } })
            .select('referenceNumber customerName phone')
            .lean()
        : [];
    const leadsById = new Map(leads.map((lead) => [String(lead._id), lead]));

    return events.map((event) => {
        const eventLeadIds = getEventLeadIds(event);
        const targetId = String(event.targetId || '').trim();
        return {
            ...event,
            actorName: userNamesById.get(String(event.actorId || '')) || '',
            description: describeActivityEvent(event, userNamesById),
            lead: targetId ? buildLeadActivityIdentity(leadsById.get(targetId), targetId) : null,
            bulkLeads: eventLeadIds
                .filter((leadId) => leadId !== targetId)
                .map((leadId) => buildLeadActivityIdentity(leadsById.get(leadId), leadId))
        };
    });
}

async function paginateRecentActivityEvents(events, users, requestedPage) {
    const totalPages = Math.max(1, Math.ceil(events.length / RECENT_ACTIVITY_PAGE_SIZE));
    const currentPage = Math.min(normalizeActivityPage(requestedPage), totalPages);
    const start = (currentPage - 1) * RECENT_ACTIVITY_PAGE_SIZE;
    const recentEvents = await enrichRecentActivityEvents(
        events.slice(start, start + RECENT_ACTIVITY_PAGE_SIZE),
        users
    );

    return {
        recentEvents,
        pagination: {
            currentPage,
            totalPages,
            totalEvents: events.length,
            pageSize: RECENT_ACTIVITY_PAGE_SIZE
        }
    };
}

module.exports = {
    buildLeadActivityIdentity,
    enrichRecentActivityEvents,
    normalizeActivityPage,
    paginateRecentActivityEvents
};

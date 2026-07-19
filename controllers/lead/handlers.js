const Lead = require('../../models/Lead');
const User = require('../../models/User');
const { canAccess } = require('../../utils/permissions');
const { PHONE_VALIDATION_MESSAGE, normalizePhoneNumber, isValidPhoneNumber } = require('../../utils/phone');
const { logAuditEvent } = require('../../utils/auditLogger');
const {
    duplicateLeadMessage,
    normalizeLeadCustomerName,
    normalizeLeadActivityFilter,
    normalizeLeadRequestFilter,
    normalizeLeadType,
    normalizeLeadFollowUpFilter,
    normalizeLeadSortField,
    normalizeLeadSortOrder,
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
} = require('./queryUtils');
const {
    buildLeadWritePayloadFromRequest,
    buildLeadChangedFields
} = require('./mutationUtils');
const {
    parseLeadPagination,
    buildPreservedLeadQueryParams,
    buildImportSummary,
    fetchLeadListingData
} = require('./listingUtils');
const {
    resolveBulkAssignedUser,
    buildPendingInactiveRequestPayload,
    buildApprovedInactiveRequestPayload,
    buildRejectedInactiveRequestSet
} = require('./workflowUtils');
const {
    createLeadCsv,
    importLeadsFromCsvText
} = require('./csvUtils');
const {
    getCurrentRole,
    getCurrentUserId,
    getCurrentUserName,
    buildLeadScopeQuery,
    ensureLeadPolicy,
    sendLeadFormSuccess,
    sendLeadFormError
} = require('./accessUtils');

async function fetchLeadOverview(req) {
    const leadScope = buildLeadScopeQuery(req, 'view');
    if (!leadScope) {
        return [];
    }

    const scopeQuery = {
        ...leadScope,
        ...buildLeadActivityQuery(normalizeLeadActivityFilter(req.query.activity))
    };

    return Lead.find(scopeQuery)
        .populate('assignedUser', 'name email')
        .sort({ updatedAt: -1 });
}

async function getDashboard(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'view')) {
            return;
        }

        const leads = await fetchLeadOverview(req);
        res.render('index', { leads });
    } catch (err) {
        res.status(500).send(err.message);
    }
}

async function getLeadsApi(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'view')) {
            return;
        }

        const leadScope = buildLeadScopeQuery(req, 'view');
        const scopeQuery = {
            ...leadScope,
            ...buildLeadActivityQuery(normalizeLeadActivityFilter(req.query.activity))
        };

        const leads = await Lead.find(scopeQuery)
            .populate('assignedUser', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json(leads);
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

async function getLeadsVersion(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'view')) {
            return;
        }

        const filters = getLeadListFilters(req);
        const scopeQuery = buildLeadScopeQuery(req, 'view');
        const query = applyLeadListFilters(scopeQuery, filters);

        const [filteredTotal, latestLead] = await Promise.all([
            Lead.countDocuments(query),
            Lead.findOne(query)
                .select('updatedAt _id')
                .sort({ updatedAt: -1, _id: -1 })
                .lean()
        ]);

        return res.status(200).json({
            success: true,
            version: buildLeadsVersion(filteredTotal, latestLead)
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

async function getLeads(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'view')) {
            return;
        }

        const { page, limit, pageSizeOptions } = parseLeadPagination(req.query);
        const filters = getLeadListFilters(req);

        const scopeQuery = buildLeadScopeQuery(req, 'view');
        const query = applyLeadListFilters(scopeQuery, filters);
        const {
            leads,
            users,
            totalLeads,
            filteredTotal,
            totalPages,
            currentPage,
            latestLeadForVersion,
            stats
        } = await fetchLeadListingData({
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
        });

        const queryParams = buildPreservedLeadQueryParams(filters, limit);

        res.render('leads', {
            leads,
            currentPage,
            totalPages,
            totalLeads,
            filteredTotal,
            limit,
            users,
            filters,
            preservedQuery: queryParams.toString(),
            preservedQueryEntries: Array.from(queryParams.entries()),
            pageSizeOptions,
            stats,
            canCreateLead: canAccess(getCurrentRole(req), 'createLead'),
            canUpdateLead: canAccess(getCurrentRole(req), 'updateLead'),
            canDeleteLead: canAccess(getCurrentRole(req), 'deleteLead'),
            canRequestInactive: canAccess(getCurrentRole(req), 'updateLead') && !canAccess(getCurrentRole(req), 'deleteLead'),
            userRole: getCurrentRole(req),
            leadsVersion: buildLeadsVersion(filteredTotal, latestLeadForVersion),
            emailSent: req.query.emailSent || null,
            importSummary: buildImportSummary(req.query)
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
}

async function emailExportLeads(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'view')) return;

        if (!process.env.EXPORT_EMAIL_USER || !process.env.EXPORT_EMAIL_PASS) {
            return res.redirect('/leads?emailSent=error');
        }

        const { runExport } = require('../../jobs/dailyLeadExport');
        await runExport();
        res.redirect('/leads?emailSent=1');
    } catch (err) {
        console.error('[Email Export] Manual trigger failed:', err.message);
        res.redirect('/leads?emailSent=error');
    }
}

async function exportLeadsCsv(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'view')) {
            return;
        }

        const scopeQuery = buildLeadScopeQuery(req, 'view');
        const filters = getLeadListFilters(req);
        const query = applyLeadListFilters(scopeQuery, filters);
        const leads = await Lead.find(query)
            .sort(buildLeadListSort(filters))
            .populate('assignedUser', 'email')
            .lean();
        const csv = createLeadCsv(leads);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        const fileLabel = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).replace(' ', '_').replace(/:/g, '-');
        res.setHeader('Content-Disposition', `attachment; filename="leads-${fileLabel}.csv"`);
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).send(err.message);
    }
}

async function importLeadsCsv(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'create')) {
            return;
        }

        const csvText = String(req.body.csvText || '');
        const importResult = await importLeadsFromCsvText(csvText);

        if (!importResult.success) {
            return res.status(importResult.statusCode).send(importResult.message);
        }

        res.redirect(`/leads?imported=${importResult.importedCount}&updated=${importResult.updatedCount}&skipped=${importResult.skippedCount}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
}

async function addLead(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'create')) {
            return;
        }

        const normalizedPhone = normalizePhoneNumber(req.body.phone);

        if (!isValidPhoneNumber(normalizedPhone)) {
            return sendLeadFormError(req, res, 400, PHONE_VALIDATION_MESSAGE);
        }

        const role = String(getCurrentRole(req) || '').toLowerCase();
        const currentUserId = getCurrentUserId(req);

        if (role === 'sales' && !currentUserId) {
            return sendLeadFormError(req, res, 400, 'Sales user session invalid. Please login again.');
        }

        const payload = buildLeadWritePayloadFromRequest(req.body, normalizedPhone);

        if (role === 'sales') {
            // Sales-created leads must stay in sales scope and cannot be created as inactive directly.
            payload.assignedUser = currentUserId;
            payload.isActive = true;
        }

        const newLead = new Lead(payload);

        await newLead.save();
        await logAuditEvent(req, {
            action: 'leads.create',
            targetType: 'lead',
            targetId: String(newLead._id),
            metadata: {
                assignedUser: newLead.assignedUser ? String(newLead.assignedUser) : '',
                status: newLead.status,
                leadType: newLead.leadType
            }
        });
        return sendLeadFormSuccess(req, res, 'নতুন লিড সফলভাবে তৈরি হয়েছে।');
    } catch (err) {
        if (err.code === 11000) {
            return sendLeadFormError(req, res, 400, duplicateLeadMessage(err, 'এই তথ্যটি আগে থেকেই ব্যবহৃত হয়েছে।'));
        }
        return sendLeadFormError(req, res, 500, err.message);
    }
}

async function requestLeadInactive(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'update')) {
            return;
        }

        if (canAccess(getCurrentRole(req), 'deleteLead')) {
            return sendLeadFormError(req, res, 403, 'Admins can archive leads directly.');
        }

        const scopeQuery = buildLeadScopeQuery(req, 'update');
        const lead = await Lead.findOne({
            ...scopeQuery,
            _id: req.params.id
        }).select('isActive inactiveRequest');

        if (!lead) {
            return sendLeadFormError(req, res, 404, 'Lead not found.');
        }

        if (lead.isActive === false) {
            return sendLeadFormSuccess(req, res, 'লিড ইতোমধ্যেই inactive আছে।');
        }

        if (lead.inactiveRequest && lead.inactiveRequest.status === 'pending') {
            return sendLeadFormSuccess(req, res, 'এই লিডের inactive request আগে থেকেই pending আছে।');
        }

        await Lead.findOneAndUpdate({
            ...scopeQuery,
            _id: req.params.id
        }, {
            $set: {
                inactiveRequest: buildPendingInactiveRequestPayload({
                    requestNote: req.body.requestNote,
                    currentUserId: getCurrentUserId(req),
                    currentUserName: getCurrentUserName(req)
                })
            }
        });

        await logAuditEvent(req, {
            action: 'leads.inactive_request',
            targetType: 'lead',
            targetId: String(lead._id),
            metadata: {
                requestedBy: getCurrentUserId(req)
            }
        });

        return sendLeadFormSuccess(req, res, 'Inactive approval request সফলভাবে পাঠানো হয়েছে।');
    } catch (err) {
        return sendLeadFormError(req, res, 500, err.message);
    }
}

async function updateLead(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'update')) {
            return;
        }

        const normalizedPhone = normalizePhoneNumber(req.body.phone);

        if (!isValidPhoneNumber(normalizedPhone)) {
            return sendLeadFormError(req, res, 400, PHONE_VALIDATION_MESSAGE);
        }

        const role = String(getCurrentRole(req) || '').toLowerCase();
        const scopeQuery = buildLeadScopeQuery(req, 'update');

        const existingLead = await Lead.findOne({
            ...scopeQuery,
            _id: req.params.id
        }).select('customerName phone preferredLocation propertyType budgetMin budgetMax preferredSize bedrooms purpose source assignedUser leadType priority status isActive followUpDate messageNote');

        if (!existingLead) {
            return sendLeadFormError(req, res, 404, 'Lead not found.');
        }

        const updatePayload = buildLeadWritePayloadFromRequest(req.body, normalizedPhone);

        if (role === 'sales') {
            // Sales users can edit details, but cannot directly inactivate or reassign leads.
            updatePayload.isActive = existingLead.isActive !== false;
            updatePayload.assignedUser = existingLead.assignedUser || null;
        }

        const changedFields = buildLeadChangedFields(existingLead, updatePayload);

        await Lead.findOneAndUpdate(
            {
                ...scopeQuery,
                _id: req.params.id
            },
            updatePayload
        );

        if (changedFields.length) {
            await logAuditEvent(req, {
                action: 'leads.update',
                targetType: 'lead',
                targetId: String(existingLead._id),
                metadata: {
                    changedFields,
                    status: updatePayload.status,
                    followUpDate: updatePayload.followUpDate || null
                }
            });
        }

        return sendLeadFormSuccess(req, res, 'লিড সফলভাবে আপডেট হয়েছে।');
    } catch (err) {
        if (err.code === 11000) {
            return sendLeadFormError(req, res, 400, duplicateLeadMessage(err, 'এই তথ্যটি অন্য একটি লিডে আগে থেকেই ব্যবহার করা হয়েছে।'));
        }
        return sendLeadFormError(req, res, 500, err.message);
    }
}

async function bulkAssignLeads(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'update')) {
            return;
        }

        const leadIds = normalizeLeadIds(req.body.leadIds);
        if (!leadIds.length) {
            return sendLeadFormError(req, res, 400, 'Assign করার জন্য অন্তত ১টি লিড সিলেক্ট করুন।');
        }

        const assignedUserRaw = String(req.body.assignedUser || '').trim();
        const assignment = await resolveBulkAssignedUser(assignedUserRaw);
        if (!assignment.success) {
            return sendLeadFormError(req, res, assignment.statusCode, assignment.message);
        }
        let { assignedUser } = assignment;

        const role = String(getCurrentRole(req) || '').toLowerCase();
        if (role === 'sales') {
            const currentUserId = getCurrentUserId(req);
            if (!currentUserId) {
                return sendLeadFormError(req, res, 400, 'Sales user session invalid. Please login again.');
            }

            if (assignedUser && String(assignedUser) !== String(currentUserId)) {
                return sendLeadFormError(req, res, 403, 'Sales users can only assign leads to themselves.');
            }

            assignedUser = currentUserId;
        }

        const scopeQuery = buildLeadScopeQuery(req, 'update');
        const result = await Lead.updateMany(
            {
                ...scopeQuery,
                _id: { $in: leadIds }
            },
            {
                $set: {
                    assignedUser
                }
            }
        );

        if (!result.matchedCount) {
            return sendLeadFormError(req, res, 404, 'সিলেক্ট করা লিড পাওয়া যায়নি অথবা আপনার access নেই।');
        }

        await logAuditEvent(req, {
            action: 'leads.bulk_assign',
            targetType: 'lead',
            metadata: {
                assignedUser: assignedUser ? String(assignedUser) : '',
                leadIds: leadIds.map((leadId) => String(leadId)),
                leadCount: result.modifiedCount
            }
        });

        return sendLeadFormSuccess(req, res, `${result.modifiedCount} টি লিড assign সফল হয়েছে।`);
    } catch (err) {
        return sendLeadFormError(req, res, 500, err.message);
    }
}

async function deleteLead(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'delete')) {
            return;
        }

        const scopeQuery = buildLeadScopeQuery(req, 'delete');

        const lead = await Lead.findOne({
            ...scopeQuery,
            _id: req.params.id
        }).select('inactiveRequest');
        if (!lead) {
            return sendLeadFormError(req, res, 404, 'Lead not found.');
        }
        const hasPendingRequest = lead && lead.inactiveRequest && lead.inactiveRequest.status === 'pending';

        await Lead.findOneAndUpdate({
            ...scopeQuery,
            _id: req.params.id
        }, {
            isActive: false,
            ...(hasPendingRequest ? {
                inactiveRequest: buildApprovedInactiveRequestPayload({
                    lead,
                    reviewNote: req.body.reviewNote,
                    currentUserId: getCurrentUserId(req),
                    currentUserName: getCurrentUserName(req)
                })
            } : {})
        });
        await logAuditEvent(req, {
            action: 'leads.inactivate',
            targetType: 'lead',
            targetId: String(lead._id),
            metadata: {
                approvedInactiveRequest: hasPendingRequest
            }
        });
        return sendLeadFormSuccess(req, res, 'লিড inactive করা হয়েছে।');
    } catch (err) {
        return sendLeadFormError(req, res, 500, err.message);
    }
}

async function rejectLeadInactiveRequest(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'delete')) {
            return;
        }

        const scopeQuery = buildLeadScopeQuery(req, 'delete');

        const result = await Lead.findOneAndUpdate(
            {
                ...scopeQuery,
                _id: req.params.id,
                'inactiveRequest.status': 'pending'
            },
            {
                $set: buildRejectedInactiveRequestSet({
                    reviewNote: req.body.reviewNote,
                    currentUserId: getCurrentUserId(req),
                    currentUserName: getCurrentUserName(req)
                })
            }
        );

        if (!result) {
            return sendLeadFormError(req, res, 404, 'Pending inactive request পাওয়া যায়নি।');
        }

        await logAuditEvent(req, {
            action: 'leads.inactive_reject',
            targetType: 'lead',
            targetId: String(result._id),
            metadata: {
                reviewedBy: getCurrentUserId(req)
            }
        });

        return sendLeadFormSuccess(req, res, 'Inactive request reject করা হয়েছে।');
    } catch (err) {
        return sendLeadFormError(req, res, 500, err.message);
    }
}

async function restoreLead(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'delete')) {
            return;
        }

        const scopeQuery = buildLeadScopeQuery(req, 'delete');
        const result = await Lead.findOneAndUpdate({
            ...scopeQuery,
            _id: req.params.id
        }, {
            isActive: true
        });

        if (!result) {
            return sendLeadFormError(req, res, 404, 'Lead not found.');
        }

        await logAuditEvent(req, {
            action: 'leads.restore',
            targetType: 'lead',
            targetId: String(result._id)
        });

        return sendLeadFormSuccess(req, res, 'লিড আবার active করা হয়েছে।');
    } catch (err) {
        return sendLeadFormError(req, res, 500, err.message);
    }
}

async function addTimelineActivity(req, res) {
    try {
        if (!ensureLeadPolicy(req, res, 'update')) {
            return;
        }

        const { leadId, activityType, note } = req.body;
        const scopeQuery = buildLeadScopeQuery(req, 'update');

        const updatedLead = await Lead.findOneAndUpdate({
            ...scopeQuery,
            _id: leadId
        }, {
            $push: { timeline: { activityType, note } }
        });

        if (!updatedLead) {
            return res.status(404).send('Lead not found.');
        }

        await logAuditEvent(req, {
            action: 'leads.note_add',
            targetType: 'lead',
            targetId: String(updatedLead._id),
            metadata: {
                activityType: String(activityType || '').trim()
            }
        });

        res.redirect('/leads');
    } catch (err) {
        res.status(500).send(err.message);
    }
}

module.exports = {
    getDashboard,
    getLeadsApi,
    getLeadsVersion,
    getLeads,
    emailExportLeads,
    exportLeadsCsv,
    importLeadsCsv,
    addLead,
    requestLeadInactive,
    updateLead,
    bulkAssignLeads,
    deleteLead,
    rejectLeadInactiveRequest,
    restoreLead,
    addTimelineActivity,
    __testables: {
        buildLeadScopeQuery,
        normalizeLeadCustomerName,
        normalizeLeadActivityFilter,
        normalizeLeadRequestFilter,
        normalizeLeadType,
        normalizeLeadFollowUpFilter,
        normalizeLeadSortField,
        normalizeLeadSortOrder,
        buildLeadActivityQuery,
        buildLeadTypeQuery,
        buildLeadFollowUpQuery,
        buildLeadListSort,
        buildLeadRequestQuery,
        withAdditionalCondition,
        parseLeadActiveValue,
        normalizeLeadIds,
        applyLeadListFilters
    }
};

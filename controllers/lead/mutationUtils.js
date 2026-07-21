const mongoose = require('mongoose');
const {
    normalizeLeadCustomerName,
    normalizeLeadType,
    parseLeadActiveValue
} = require('./queryUtils');

function normalizeTrimmedValue(value) {
    if (value === null || value === undefined) {
        return undefined;
    }

    const normalized = String(value).trim();
    return normalized || undefined;
}

function toNumberOrZero(value) {
    return value ? Number(value) : 0;
}

function normalizeComparableValue(value, fieldName) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (fieldName === 'followUpDate') {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
        }

        return String(value).trim().slice(0, 10);
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }

    if (value && typeof value === 'object' && typeof value.toString === 'function') {
        return String(value.toString()).trim();
    }

    return String(value).trim();
}

function buildLeadChangedFields(existingLead, updatePayload) {
    if (!existingLead || !updatePayload) {
        return [];
    }

    return Object.keys(updatePayload).filter((fieldName) => {
        const previousValue = normalizeComparableValue(existingLead[fieldName], fieldName);
        const nextValue = normalizeComparableValue(updatePayload[fieldName], fieldName);
        return previousValue !== nextValue;
    });
}

function buildLeadFieldChanges(existingLead, updatePayload, changedFields) {
    const reportableFields = new Set([
        'assignedUser',
        'followUpDate',
        'isActive',
        'leadType',
        'priority',
        'status'
    ]);

    return (Array.isArray(changedFields) ? changedFields : [])
        .filter((fieldName) => reportableFields.has(fieldName))
        .reduce((changes, fieldName) => {
            changes[fieldName] = {
                from: normalizeComparableValue(existingLead[fieldName], fieldName),
                to: normalizeComparableValue(updatePayload[fieldName], fieldName)
            };
            return changes;
        }, {});
}

function buildLeadWritePayloadFromRequest(body, normalizedPhone) {
    const normalizedPurpose = normalizeTrimmedValue(body.purpose);
    const normalizedPropertyType = normalizeTrimmedValue(body.propertyType);
    const normalizedSource = normalizeTrimmedValue(body.source);

    return {
        customerName: normalizeLeadCustomerName(body.customerName),
        phone: normalizedPhone,
        preferredLocation: body.preferredLocation,
        propertyType: normalizedPropertyType || undefined,
        budgetMin: toNumberOrZero(body.budgetMin),
        budgetMax: toNumberOrZero(body.budgetMax),
        preferredSize: body.preferredSize,
        bedrooms: toNumberOrZero(body.bedrooms),
        purpose: normalizedPurpose || undefined,
        source: normalizedSource || undefined,
        assignedUser: body.assignedUser || null,
        leadType: normalizeLeadType(body.leadType, 'good'),
        priority: body.priority,
        status: body.status,
        isActive: parseLeadActiveValue(body.isActive),
        followUpDate: body.followUpDate,
        messageNote: body.messageNote
    };
}

function buildLeadWritePayloadFromCsvRow(rowData, resolvedAssignedUser) {
    return {
        customerName: normalizeLeadCustomerName(rowData.customerName),
        preferredLocation: rowData.preferredLocation || undefined,
        propertyType: normalizeTrimmedValue(rowData.propertyType) || undefined,
        budgetMin: toNumberOrZero(rowData.budgetMin),
        budgetMax: toNumberOrZero(rowData.budgetMax),
        preferredSize: rowData.preferredSize || undefined,
        bedrooms: toNumberOrZero(rowData.bedrooms),
        purpose: normalizeTrimmedValue(rowData.purpose) || undefined,
        source: normalizeTrimmedValue(rowData.source) || undefined,
        leadType: normalizeLeadType(rowData.leadType, 'good'),
        priority: rowData.priority || undefined,
        status: rowData.status || undefined,
        isActive: rowData.isActive === 'false' ? false : true,
        followUpDate: rowData.followUpDate || undefined,
        assignedUser: resolvedAssignedUser,
        messageNote: rowData.messageNote || undefined
    };
}

async function resolveAssignedUserForCsvRow(rowData, assignedUserEmailCache, findUserByEmail) {
    const assignedUserEmail = String(rowData.assignedUserEmail || '').trim().toLowerCase();
    const assignedUserIdRaw = String(rowData.assignedUser || '').trim();

    let resolvedAssignedUser = null;

    if (assignedUserEmail) {
        if (assignedUserEmailCache.has(assignedUserEmail)) {
            resolvedAssignedUser = assignedUserEmailCache.get(assignedUserEmail);
        } else {
            const user = await findUserByEmail(assignedUserEmail);
            resolvedAssignedUser = user ? user._id : null;
            assignedUserEmailCache.set(assignedUserEmail, resolvedAssignedUser);
        }
    }

    if (!resolvedAssignedUser && assignedUserIdRaw && mongoose.Types.ObjectId.isValid(assignedUserIdRaw)) {
        resolvedAssignedUser = assignedUserIdRaw;
    }

    return resolvedAssignedUser;
}

module.exports = {
    buildLeadWritePayloadFromRequest,
    buildLeadWritePayloadFromCsvRow,
    resolveAssignedUserForCsvRow,
    buildLeadChangedFields,
    buildLeadFieldChanges
};

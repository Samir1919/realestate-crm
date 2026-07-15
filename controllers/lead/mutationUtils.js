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
    resolveAssignedUserForCsvRow
};

const {
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
} = require('./listFiltersUtils');

const LEAD_CSV_COLUMNS = [
    'referenceNumber',
    'customerName',
    'phone',
    'preferredLocation',
    'propertyType',
    'budgetMin',
    'budgetMax',
    'preferredSize',
    'bedrooms',
    'purpose',
    'source',
    'leadType',
    'priority',
    'status',
    'isActive',
    'followUpDate',
    'assignedUserEmail',
    'messageNote',
    'createdAt'
];

function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const text = String(value);
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);
    return values;
}

function normalizeCsvRows(csvText) {
    const normalizedText = String(csvText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalizedText) {
        return [];
    }

    return normalizedText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function duplicateLeadMessage(err, fallbackMessage) {
    const duplicateField = Object.keys(err.keyPattern || {})[0] || Object.keys(err.keyValue || {})[0];

    if (duplicateField === 'phone') {
        return 'এই ফোন নম্বরটি দিয়ে ইতিমধ্যেই একটি লিড রয়েছে।';
    }

    if (duplicateField === 'referenceNumber') {
        return 'এই রেফারেন্স নম্বরটি আগে থেকেই আছে। আবার চেষ্টা করুন।';
    }

    if (duplicateField === 'leadNumber') {
        return 'এই লিড নম্বরটি আগে থেকেই আছে। আবার চেষ্টা করুন।';
    }

    return fallbackMessage;
}

function normalizeOptionalText(value) {
    if (value === null || value === undefined) {
        return undefined;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return undefined;
    }

    if (normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
        return undefined;
    }

    return normalized;
}

function normalizeLeadCustomerName(value) {
    const normalized = normalizeOptionalText(value);

    if (!normalized) {
        return undefined;
    }

    const sanitized = normalized
        .normalize('NFKC')
        .replace(/[^\p{L}\p{M}\p{N}.' -]+/gu, ' ')
        .replace(/\s+/g, ' ');

    return sanitized.trim() || undefined;
}

module.exports = {
    LEAD_CSV_COLUMNS,
    escapeCsvValue,
    parseCsvLine,
    normalizeCsvRows,
    duplicateLeadMessage,
    normalizeOptionalText,
    normalizeLeadCustomerName,
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

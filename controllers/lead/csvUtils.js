const Lead = require('../../models/Lead');
const User = require('../../models/User');
const { normalizePhoneNumber, isValidPhoneNumber } = require('../../utils/phone');
const {
    LEAD_CSV_COLUMNS,
    escapeCsvValue,
    parseCsvLine,
    normalizeCsvRows
} = require('./queryUtils');
const {
    buildLeadWritePayloadFromCsvRow,
    resolveAssignedUserForCsvRow
} = require('./mutationUtils');

function createLeadCsv(leads) {
    const header = LEAD_CSV_COLUMNS.join(',');
    const rows = leads.map((lead) => LEAD_CSV_COLUMNS.map((column) => {
        if (column === 'followUpDate' || column === 'createdAt') {
            if (!lead[column]) {
                return '';
            }

            try {
                return escapeCsvValue(new Date(lead[column]).toISOString().split('T')[0]);
            } catch (error) {
                return '';
            }
        }

        if (column === 'assignedUserEmail') {
            return escapeCsvValue(lead.assignedUser && lead.assignedUser.email ? lead.assignedUser.email : '');
        }

        if (column === 'isActive') {
            return escapeCsvValue(lead.isActive !== false);
        }

        return escapeCsvValue(lead[column]);
    }).join(','));

    return [header, ...rows].join('\n');
}

async function importLeadsFromCsvText(csvText) {
    const rows = normalizeCsvRows(csvText);

    if (!rows.length) {
        return {
            success: false,
            statusCode: 400,
            message: 'CSV data is empty'
        };
    }

    const headerValues = parseCsvLine(rows[0]).map((value) => String(value || '').trim());
    const hasHeader = headerValues.includes('phone');
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const assignedUserEmailCache = new Map();

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of dataRows) {
        const values = parseCsvLine(row);
        const rowData = {};

        if (hasHeader) {
            headerValues.forEach((header, index) => {
                if (header) {
                    rowData[header] = String(values[index] || '').trim();
                }
            });
        } else {
            LEAD_CSV_COLUMNS.forEach((header, index) => {
                rowData[header] = String(values[index] || '').trim();
            });
        }

        const phone = normalizePhoneNumber(rowData.phone);
        if (!phone || !isValidPhoneNumber(phone)) {
            skippedCount += 1;
            continue;
        }

        const resolvedAssignedUser = await resolveAssignedUserForCsvRow(
            rowData,
            assignedUserEmailCache,
            async (email) => User.findOne({ email }).select('_id').lean()
        );

        try {
            const updateFields = buildLeadWritePayloadFromCsvRow(rowData, resolvedAssignedUser);

            const result = await Lead.findOneAndUpdate(
                { phone },
                { $set: updateFields },
                { upsert: true, new: false, lean: true }
            );

            if (result) {
                updatedCount += 1;
            } else {
                importedCount += 1;
            }
        } catch (error) {
            skippedCount += 1;
        }
    }

    return {
        success: true,
        importedCount,
        updatedCount,
        skippedCount
    };
}

module.exports = {
    createLeadCsv,
    importLeadsFromCsvText
};

const Lead = require('../models/Lead');
const User = require('../models/User');
const mongoose = require('mongoose');
const { canAccess } = require('../utils/permissions');
const { PHONE_VALIDATION_MESSAGE, normalizePhoneNumber, isValidPhoneNumber } = require('../utils/phone');

const LEAD_CSV_COLUMNS = [
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
    'priority',
    'status',
    'followUpDate',
    'messageNote'
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

function getCurrentRole(req) {
    if (req.session && req.session.user && req.session.user.role) {
        return req.session.user.role;
    }
    return 'viewer';
}

function getCurrentUserId(req) {
    if (!req.session || !req.session.user || !req.session.user.id) {
        return null;
    }

    return String(req.session.user.id);
}

function buildLeadScopeQuery(req) {
    const role = getCurrentRole(req).toLowerCase();
    const userId = getCurrentUserId(req);

    if (role === 'sales' && userId && mongoose.Types.ObjectId.isValid(userId)) {
        return {
            assignedUser: new mongoose.Types.ObjectId(userId)
        };
    }

    return {};
}

function ensurePermission(req, res, permission) {
    const role = getCurrentRole(req);
    if (!canAccess(role, permission)) {
        res.status(403).send('You do not have permission to perform this action.');
        return false;
    }
    return true;
}

function isAjaxRequest(req) {
    const accepts = String(req.headers.accept || '');
    return req.xhr || accepts.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest';
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

function sendLeadFormSuccess(req, res, message) {
    if (isAjaxRequest(req)) {
        return res.status(200).json({
            success: true,
            message
        });
    }

    return res.redirect('/leads');
}

function sendLeadFormError(req, res, statusCode, message) {
    if (isAjaxRequest(req)) {
        return res.status(statusCode).json({
            success: false,
            message
        });
    }

    return res.status(statusCode).send(message);
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

exports.getLeadsApi = async (req, res) => {
    try {
        if (!ensurePermission(req, res, 'viewLeads')) {
            return;
        }

        const scopeQuery = buildLeadScopeQuery(req);

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
};

// exports.getLeads = async (req, res) => {
//     try {
//         const leads = await Lead.find().sort({ createdAt: -1 });
//         res.render('leads', { leads });
//     } catch (err) {
//         res.status(500).send(err.message);
//     }
// };

exports.getLeads = async (req, res) => {
    try {
        if (!ensurePermission(req, res, 'viewLeads')) {
            return;
        }
        // ১. কুয়েরি থেকে কারেন্ট পেজ নাম্বার নিন (ডিফল্ট পেজ ১)
        const page = parseInt(req.query.page) || 1;

        // ২. প্রতি পেজে কয়টি করে লিড দেখাতে চান তা সেট করুন
        const limit = 10;

        const filters = {
            q: (req.query.q || '').trim(),
            status: (req.query.status || '').trim(),
            source: (req.query.source || '').trim(),
            priority: (req.query.priority || '').trim(),
            assignedUser: (req.query.assignedUser || '').trim(),
            propertyType: (req.query.propertyType || '').trim()
        };

        const scopeQuery = buildLeadScopeQuery(req);
        const query = { ...scopeQuery };

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

        // ৩. কতগুলো ডাটা স্কিপ করতে হবে তার হিসাব
        const skip = (page - 1) * limit;

        // ৪. ডাটাবেজে মোট কতগুলো লিড আছে তা কাউন্ট করুন
        const totalLeads = await Lead.countDocuments(scopeQuery);
        const filteredTotal = await Lead.countDocuments(query);

        const users = await User.find()
            .select('name email role')
            .sort({ name: 1 });

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const [hotLeadsCount, newLeadsCount, todayFollowUpsCount] = await Promise.all([
            Lead.countDocuments({ ...query, priority: 'Hot' }),
            Lead.countDocuments({ ...query, status: 'New' }),
            Lead.countDocuments({
                ...query,
                followUpDate: {
                    $gte: startOfToday,
                    $lte: endOfToday
                }
            })
        ]);

        // 🔍 নির্দিষ্ট পেজের লিডগুলো নিয়ে আসুন (নতুন লিড সবার আগে থাকবে)
        const leads = await Lead.find()
            .find(query)
            .populate('assignedUser', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // ৫. মোট কতগুলো পেজ তৈরি হবে তার হিসাব
        const totalPages = Math.ceil(filteredTotal / limit);

        const queryParams = new URLSearchParams();
        if (filters.q) queryParams.set('q', filters.q);
        if (filters.status) queryParams.set('status', filters.status);
        if (filters.source) queryParams.set('source', filters.source);
        if (filters.priority) queryParams.set('priority', filters.priority);
        if (filters.assignedUser) queryParams.set('assignedUser', filters.assignedUser);
        if (filters.propertyType) queryParams.set('propertyType', filters.propertyType);

        // 📤 ভিউ ফাইলে সব ভেরিয়েবল একসাথে পাস করুন
        res.render('leads', {
            leads,
            currentPage: page,
            totalPages,
            totalLeads,
            filteredTotal,
            limit,
            users,
            filters,
            preservedQuery: queryParams.toString(),
            stats: {
                hotLeadsCount,
                newLeadsCount,
                todayFollowUpsCount
            },
            canCreateLead: canAccess(getCurrentRole(req), 'createLead'),
            canUpdateLead: canAccess(getCurrentRole(req), 'updateLead'),
            canDeleteLead: canAccess(getCurrentRole(req), 'deleteLead'),
            userRole: getCurrentRole(req),
            importSummary: {
                imported: Number.parseInt(req.query.imported || '0', 10) || 0,
                skipped: Number.parseInt(req.query.skipped || '0', 10) || 0,
                hasResult: Object.prototype.hasOwnProperty.call(req.query, 'imported')
            }
        });

    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.exportLeadsCsv = async (req, res) => {
    try {
        if (!ensurePermission(req, res, 'viewLeads')) {
            return;
        }

        const scopeQuery = buildLeadScopeQuery(req);
        const leads = await Lead.find(scopeQuery).sort({ createdAt: -1 }).lean();

        const header = LEAD_CSV_COLUMNS.join(',');
        const rows = leads.map((lead) => LEAD_CSV_COLUMNS.map((column) => {
            if (column === 'followUpDate') {
                if (!lead.followUpDate) {
                    return '';
                }

                try {
                    return escapeCsvValue(new Date(lead.followUpDate).toISOString().split('T')[0]);
                } catch (error) {
                    return '';
                }
            }

            return escapeCsvValue(lead[column]);
        }).join(','));

        const csv = [header, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="leads-export-${Date.now()}.csv"`);
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.importLeadsCsv = async (req, res) => {
    try {
        if (!ensurePermission(req, res, 'createLead')) {
            return;
        }

        const csvText = String(req.body.csvText || '');
        const rows = normalizeCsvRows(csvText);

        if (!rows.length) {
            return res.status(400).send('CSV data is empty');
        }

        const headerValues = parseCsvLine(rows[0]).map((value) => String(value || '').trim());
        const hasHeader = headerValues.includes('phone');
        const dataRows = hasHeader ? rows.slice(1) : rows;

        let importedCount = 0;
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

            const normalizedPurpose = rowData.purpose ? String(rowData.purpose).trim() : undefined;
            const normalizedPropertyType = rowData.propertyType ? String(rowData.propertyType).trim() : undefined;
            const normalizedSource = rowData.source ? String(rowData.source).trim() : undefined;

            try {
                const lead = new Lead({
                    customerName: normalizeOptionalText(rowData.customerName),
                    phone,
                    preferredLocation: rowData.preferredLocation || undefined,
                    propertyType: normalizedPropertyType || undefined,
                    budgetMin: rowData.budgetMin ? Number(rowData.budgetMin) : 0,
                    budgetMax: rowData.budgetMax ? Number(rowData.budgetMax) : 0,
                    preferredSize: rowData.preferredSize || undefined,
                    bedrooms: rowData.bedrooms ? Number(rowData.bedrooms) : 0,
                    purpose: normalizedPurpose || undefined,
                    source: normalizedSource || undefined,
                    priority: rowData.priority || undefined,
                    status: rowData.status || undefined,
                    followUpDate: rowData.followUpDate || undefined,
                    messageNote: rowData.messageNote || undefined
                });

                await lead.save();
                importedCount += 1;
            } catch (error) {
                skippedCount += 1;
            }
        }

        res.redirect(`/leads?imported=${importedCount}&skipped=${skippedCount}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.addLead = async (req, res) => {
    try {
        if (!ensurePermission(req, res, 'createLead')) {
            return;
        }
        // মডেলের এক্সাক্ট ফিল্ডের নাম অনুযায়ী ফ্রন্টএন্ড থেকে ডেটা রিসিভ করা হচ্ছে
        const {
            customerName,
            phone,
            preferredLocation,
            propertyType,
            budgetMin,
            budgetMax,
            preferredSize,
            bedrooms,
            purpose,
            source,
            assignedUser,
            priority,
            status,
            followUpDate,
            messageNote
        } = req.body;

        const normalizedCustomerName = normalizeOptionalText(customerName);
        const normalizedPhone = normalizePhoneNumber(phone);
        const normalizedPurpose = purpose ? String(purpose).trim() : undefined;
        const normalizedPropertyType = propertyType ? String(propertyType).trim() : undefined;
        const normalizedSource = source ? String(source).trim() : undefined;

        if (!isValidPhoneNumber(normalizedPhone)) {
            return sendLeadFormError(req, res, 400, PHONE_VALIDATION_MESSAGE);
        }

        // একদম সেম নামে মডেলে পাস করা হলো
        const newLead = new Lead({
            customerName: normalizedCustomerName,
            phone: normalizedPhone,
            preferredLocation,
            propertyType: normalizedPropertyType || undefined,
            budgetMin: budgetMin ? Number(budgetMin) : 0,
            budgetMax: budgetMax ? Number(budgetMax) : 0,
            preferredSize,
            bedrooms: bedrooms ? Number(bedrooms) : 0,
            purpose: normalizedPurpose || undefined,
            source: normalizedSource || undefined,
            assignedUser: assignedUser || null,
            priority,
            status,
            followUpDate,
            messageNote
        });

        await newLead.save();
        return sendLeadFormSuccess(req, res, 'নতুন লিড সফলভাবে তৈরি হয়েছে।');

    } catch (err) {
        // ডুপ্লিকেট ফোন নম্বরের এরর হ্যান্ডেলিং
        if (err.code === 11000) {
            return sendLeadFormError(req, res, 400, duplicateLeadMessage(err, 'এই তথ্যটি আগে থেকেই ব্যবহৃত হয়েছে।'));
        }
        return sendLeadFormError(req, res, 500, err.message);
    }
};

// লিড আপডেট করার ফাংশন
exports.updateLead = async (req, res) => {
    try {
        if (!ensurePermission(req, res, 'updateLead')) {
            return;
        }
        const {
            customerName,
            phone,
            preferredLocation,
            propertyType,
            budgetMin,
            budgetMax,
            preferredSize,
            bedrooms,
            purpose,
            source,
            assignedUser,
            priority,
            status,
            followUpDate,
            messageNote
        } = req.body;

        const normalizedCustomerName = normalizeOptionalText(customerName);
        const normalizedPhone = normalizePhoneNumber(phone);
        const normalizedPurpose = purpose ? String(purpose).trim() : undefined;
        const normalizedPropertyType = propertyType ? String(propertyType).trim() : undefined;
        const normalizedSource = source ? String(source).trim() : undefined;

        if (!isValidPhoneNumber(normalizedPhone)) {
            return sendLeadFormError(req, res, 400, PHONE_VALIDATION_MESSAGE);
        }

        await Lead.findByIdAndUpdate(req.params.id, {
            customerName: normalizedCustomerName,
            phone: normalizedPhone,
            preferredLocation,
            propertyType: normalizedPropertyType || undefined,
            budgetMin: budgetMin ? Number(budgetMin) : 0,
            budgetMax: budgetMax ? Number(budgetMax) : 0,
            preferredSize,
            bedrooms: bedrooms ? Number(bedrooms) : 0,
            purpose: normalizedPurpose || undefined,
            source: normalizedSource || undefined,
            assignedUser: assignedUser || null,
            priority,
            status,
            followUpDate,
            messageNote
        });

        return sendLeadFormSuccess(req, res, 'লিড সফলভাবে আপডেট হয়েছে।');

    } catch (err) {
        if (err.code === 11000) {
            return sendLeadFormError(req, res, 400, duplicateLeadMessage(err, 'এই তথ্যটি অন্য একটি লিডে আগে থেকেই ব্যবহার করা হয়েছে।'));
        }
        return sendLeadFormError(req, res, 500, err.message);
    }
};

// লিড ডিলিট করার ফাংশন
exports.deleteLead = async (req, res) => {
    try {
        if (!ensurePermission(req, res, 'deleteLead')) {
            return;
        }
        await Lead.findByIdAndDelete(req.params.id);
        res.redirect('/leads');
    } catch (err) {
        res.status(500).send(err.message);
    }
};


exports.addTimelineActivity = async (req, res) => {
    try {
        const { leadId, activityType, note } = req.body;
        await Lead.findByIdAndUpdate(leadId, {
            $push: { timeline: { activityType, note } }
        });
        res.redirect('/leads');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.__testables = {
    buildLeadScopeQuery
};
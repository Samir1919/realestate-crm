'use strict';

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
require('../models/User'); // populate assignedUser এর জন্য

// ─── CSV Builder ──────────────────────────────────────────────────────────────

function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

async function buildLeadsCSV() {
    const leads = await Lead.find()
        .sort({ createdAt: -1 })
        .populate('assignedUser', 'email')
        .lean();

    // UI export এর LEAD_CSV_COLUMNS এর সাথে exact match
    // referenceNumber ও createdAt extra info হিসেবে শুরুতে (import ignore করবে)
    const headers = [
        'referenceNumber',
        'customerName', 'phone',
        'preferredLocation', 'propertyType',
        'budgetMin', 'budgetMax',
        'preferredSize', 'bedrooms',
        'purpose', 'source',
        'leadType', 'priority', 'status', 'isActive',
        'followUpDate', 'assignedUserEmail', 'messageNote',
        'createdAt'
    ];

    const rows = leads.map(l => [
        l.referenceNumber || '',
        l.customerName || '',
        l.phone || '',
        l.preferredLocation || '',
        l.propertyType || '',
        l.budgetMin || 0,
        l.budgetMax || 0,
        l.preferredSize || '',
        l.bedrooms || 0,
        l.purpose || '',
        l.source || '',
        l.leadType || '',
        l.priority || '',
        l.status || '',
        l.isActive !== false,
        l.followUpDate ? new Date(l.followUpDate).toISOString().split('T')[0] : '',
        l.assignedUser?.email || '',
        l.messageNote || '',
        l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : ''
    ].map(escapeCSV).join(','));

    return [headers.join(','), ...rows].join('\n');
}

// ─── Email Sender ─────────────────────────────────────────────────────────────

async function sendExportEmail(csvData, dateLabel, displayLabel) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EXPORT_EMAIL_USER,
            pass: process.env.EXPORT_EMAIL_PASS   // Gmail App Password
        }
    });

    const recipients = process.env.EXPORT_EMAIL_TO || process.env.EXPORT_EMAIL_USER;

    await transporter.sendMail({
        from: `"CRM Auto Export" <${process.env.EXPORT_EMAIL_USER}>`,
        to: recipients,
        subject: `📊 Lead Export — ${displayLabel}`,
        text: `Lead export (${displayLabel}) — সব lead-এর CSV file attached আছে।`,
        attachments: [
            {
                filename: `leads-${dateLabel}.csv`,
                content: csvData,
                contentType: 'text/csv'
            }
        ]
    });
}

// ─── Main Job ─────────────────────────────────────────────────────────────────

async function runExport() {
    const now = new Date();
    // filename safe: 2026-07-11_23-00-00
    const dateLabel = now.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).replace(' ', '_').replace(/:/g, '-');
    // human readable: 2026-07-11 23:00:00
    const displayLabel = now.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' });
    console.log(`[Lead Export] Starting daily export for ${dateLabel}...`);
    try {
        const csv = await buildLeadsCSV();
        await sendExportEmail(csv, dateLabel, displayLabel);
        console.log(`[Lead Export] ✅ Email sent successfully for ${dateLabel}`);
    } catch (err) {
        console.error(`[Lead Export] ❌ Failed: ${err.message}`);
    }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
// প্রতিদিন রাত ১১:৫৯ তে চলবে। চাইলে পরিবর্তন করো।
// Cron format: second(optional) minute hour day month weekday
// '0 23 * * *'  →  রাত ১১:০০
// '59 23 * * *' →  রাত ১১:৫৯

function scheduleDailyExport() {
    const cronTime = process.env.EXPORT_CRON_TIME || '0 23 * * *';

    if (!process.env.EXPORT_EMAIL_USER || !process.env.EXPORT_EMAIL_PASS) {
        console.warn('[Lead Export] ⚠️  EXPORT_EMAIL_USER / EXPORT_EMAIL_PASS not set — daily export disabled.');
        return;
    }

    cron.schedule(cronTime, runExport, {
        timezone: 'Asia/Dhaka'
    });

    console.log(`[Lead Export] ✅ Scheduled daily export at cron "${cronTime}" (Asia/Dhaka)`);
}

module.exports = { scheduleDailyExport, runExport };

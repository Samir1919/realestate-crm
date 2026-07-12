'use strict';

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
require('../models/User'); // populate assignedUser এর জন্য

function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getMailConfig() {
    const user = String(process.env.EXPORT_EMAIL_USER || '').trim();
    // Gmail app password often gets copied with spaces; normalize for safer server deploys.
    const pass = String(process.env.EXPORT_EMAIL_PASS || '').replace(/\s+/g, '');
    const to = String(process.env.EXPORT_EMAIL_TO || user).trim();
    const host = String(process.env.EXPORT_SMTP_HOST || '').trim();
    const port = Number.parseInt(String(process.env.EXPORT_SMTP_PORT || ''), 10);
    const secure = parseBoolean(process.env.EXPORT_SMTP_SECURE, false);
    const requireTLS = parseBoolean(process.env.EXPORT_SMTP_REQUIRE_TLS, false);
    const rejectUnauthorized = parseBoolean(process.env.EXPORT_SMTP_REJECT_UNAUTHORIZED, true);

    if (!user || !pass) {
        throw new Error('EXPORT_EMAIL_USER / EXPORT_EMAIL_PASS not configured');
    }

    const transport = host
        ? {
            host,
            port: Number.isFinite(port) ? port : (secure ? 465 : 587),
            secure,
            requireTLS,
            auth: { user, pass },
            tls: {
                rejectUnauthorized
            }
        }
        : {
            service: 'gmail',
            auth: { user, pass }
        };

    return { user, to, transport };
}

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
    const mailConfig = getMailConfig();
    const transporter = nodemailer.createTransport(mailConfig.transport);

    // SMTP credentials/host validation before attempting the actual send.
    await transporter.verify();

    await transporter.sendMail({
        from: `"CRM Auto Export" <${mailConfig.user}>`,
        to: mailConfig.to,
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
        const hint = err && err.code === 'EAUTH'
            ? 'Authentication failed. Verify EXPORT_EMAIL_USER/EXPORT_EMAIL_PASS (App Password) on server.'
            : '';
        console.error(`[Lead Export] ❌ Failed: ${err.message}`);
        if (err && err.code) console.error(`[Lead Export] code=${err.code}`);
        if (err && err.command) console.error(`[Lead Export] command=${err.command}`);
        if (err && err.response) console.error(`[Lead Export] response=${err.response}`);
        if (hint) console.error(`[Lead Export] hint=${hint}`);
    }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
// প্রতিদিন রাত ১১:৫৯ তে চলবে। চাইলে পরিবর্তন করো।
// Cron format: second(optional) minute hour day month weekday
// '0 23 * * *'  →  রাত ১১:০০
// '59 23 * * *' →  রাত ১১:৫৯

function scheduleDailyExport() {
    const cronTime = process.env.EXPORT_CRON_TIME || '0 23 * * *';
    const normalizedPass = String(process.env.EXPORT_EMAIL_PASS || '').replace(/\s+/g, '');

    if (!process.env.EXPORT_EMAIL_USER || !normalizedPass) {
        console.warn('[Lead Export] ⚠️  EXPORT_EMAIL_USER / EXPORT_EMAIL_PASS not set — daily export disabled.');
        return;
    }

    cron.schedule(cronTime, runExport, {
        timezone: 'Asia/Dhaka'
    });

    console.log(`[Lead Export] ✅ Scheduled daily export at cron "${cronTime}" (Asia/Dhaka)`);
}

module.exports = { scheduleDailyExport, runExport };

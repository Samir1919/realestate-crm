require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const AuditLog = require('../models/AuditLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { normalizePhoneNumber } = require('../utils/phone');

const DEMO_PASSWORD = 'DemoSalesPass2026!';

const demoUsers = [
    { name: 'Demo Sales Active', email: 'demo.sales.active@crm.local', role: 'sales' },
    { name: 'Demo Sales Followup', email: 'demo.sales.followup@crm.local', role: 'sales' },
    { name: 'Demo Sales Quiet', email: 'demo.sales.quiet@crm.local', role: 'sales' },
    { name: 'Demo Manager', email: 'demo.manager@crm.local', role: 'admin' }
];

const demoLeadRows = [
    ['Afsana Rahman', '01710000001', 'Bashundhara R/A', 'Ready Flat', 'Hot', 'Contacted'],
    ['Mahmud Hasan', '01710000002', 'Uttara Sector 10', 'Land / Plot', 'Warm', 'Interested'],
    ['Nusrat Jahan', '01710000003', 'Mirpur DOHS', 'Ready Flat', 'Hot', 'Site Visit Scheduled'],
    ['Rakib Karim', '01710000004', 'Purbachal', 'Land Share', 'Warm', 'New'],
    ['Samira Akter', '01710000005', 'Banani', 'Commercial', 'Cold', 'Contacted'],
    ['Tanvir Ahmed', '01710000006', 'Dhanmondi', 'Ready Flat', 'Warm', 'Negotiation'],
    ['Farhana Chowdhury', '01710000007', 'Mohammadpur', 'Upcoming Project', 'Hot', 'Interested'],
    ['Imran Hossain', '01710000008', 'Gulshan', 'Commercial', 'Warm', 'Site Visit Completed'],
    ['Maliha Islam', '01710000009', 'Badda', 'Ready Flat', 'Cold', 'Lost'],
    ['Sabbir Khan', '01710000010', 'Keraniganj', 'Land / Plot', 'Warm', 'New'],
    ['Jannatul Ferdous', '01710000011', 'Aftabnagar', 'Upcoming Project', 'Hot', 'Booking Pending'],
    ['Arif Mahmud', '01710000012', 'Basabo', 'Ready Flat', 'Warm', 'Contacted']
];

function assertSafeEnvironment() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
        throw new Error('Demo seed is blocked in production. Set ALLOW_DEMO_SEED=true only if you really intend to seed demo data.');
    }
}

function dhakaDate(dateLabel, hour, minute = 0) {
    return new Date(`${dateLabel}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+06:00`);
}

async function upsertDemoUser(userData) {
    let user = await User.findOne({ email: userData.email });
    if (!user) {
        user = new User({
            ...userData,
            password: DEMO_PASSWORD
        });
    } else {
        user.name = userData.name;
        user.role = userData.role;
        user.password = DEMO_PASSWORD;
    }

    await user.save();
    return user;
}

function buildLeadPayload(row, assignedUser, index) {
    const [customerName, phone, preferredLocation, propertyType, priority, status] = row;

    return {
        customerName,
        phone: normalizePhoneNumber(phone),
        preferredLocation,
        propertyType,
        budgetMin: 4500000 + index * 300000,
        budgetMax: 7500000 + index * 450000,
        preferredSize: `${1000 + index * 75} sqft`,
        bedrooms: index % 3 === 0 ? 4 : 3,
        purpose: index % 2 === 0 ? 'Own Living' : 'Investment',
        source: ['facebook', 'google', 'whatsapp', 'phone'][index % 4],
        assignedUser: assignedUser._id,
        leadType: index === 8 ? 'bad' : 'good',
        priority,
        status,
        isActive: index !== 8,
        followUpDate: dhakaDate(index < 6 ? '2026-07-19' : '2026-07-20', 10 + (index % 6)),
        messageNote: `Demo activity seed lead ${index + 1}`
    };
}

async function upsertDemoLead(row, assignedUser, index) {
    const payload = buildLeadPayload(row, assignedUser, index);
    let lead = await Lead.findOne({ phone: payload.phone });

    if (!lead) {
        lead = new Lead(payload);
    } else {
        Object.assign(lead, payload);
    }

    await lead.save();
    return lead;
}

function buildAuditEvent(user, action, lead, createdAt, metadata = {}) {
    return {
        action,
        actorId: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        targetType: 'lead',
        targetId: lead ? String(lead._id) : '',
        success: true,
        ipAddress: '127.0.0.1',
        userAgent: 'demo-activity-seed',
        metadata: {
            ...metadata,
            demoSeed: true
        },
        createdAt
    };
}

function buildDemoAuditEvents(usersByEmail, leads) {
    const activeSales = usersByEmail.get('demo.sales.active@crm.local');
    const followupSales = usersByEmail.get('demo.sales.followup@crm.local');
    const manager = usersByEmail.get('demo.manager@crm.local');

    return [
        buildAuditEvent(activeSales, 'leads.create', leads[0], dhakaDate('2026-07-19', 9, 10), {
            status: leads[0].status,
            assignedUser: String(activeSales._id)
        }),
        buildAuditEvent(activeSales, 'leads.update', leads[0], dhakaDate('2026-07-19', 10, 20), {
            changedFields: ['status', 'followUpDate']
        }),
        buildAuditEvent(activeSales, 'leads.note_add', leads[1], dhakaDate('2026-07-19', 11, 5), {
            activityType: 'Call note'
        }),
        buildAuditEvent(activeSales, 'leads.update', leads[2], dhakaDate('2026-07-18', 15, 30), {
            changedFields: ['messageNote', 'priority']
        }),
        buildAuditEvent(followupSales, 'leads.update', leads[4], dhakaDate('2026-07-19', 12, 45), {
            changedFields: ['followUpDate']
        }),
        buildAuditEvent(followupSales, 'leads.note_add', leads[5], dhakaDate('2026-07-19', 14, 0), {
            activityType: 'Follow-up note'
        }),
        buildAuditEvent(followupSales, 'leads.inactive_request', leads[8], dhakaDate('2026-07-17', 16, 10), {
            requestedBy: String(followupSales._id)
        }),
        buildAuditEvent(manager, 'leads.bulk_assign', null, dhakaDate('2026-07-19', 16, 30), {
            assignedUser: String(followupSales._id),
            leadIds: [leads[6], leads[7], leads[10]].map((lead) => String(lead._id)),
            leadCount: 3
        }),
        buildAuditEvent(manager, 'leads.inactivate', leads[8], dhakaDate('2026-07-19', 17, 20), {
            approvedInactiveRequest: true
        }),
        buildAuditEvent(manager, 'leads.restore', leads[8], dhakaDate('2026-07-18', 10, 0), {})
    ];
}

async function seedActivityDemo() {
    assertSafeEnvironment();
    await connectDB();

    const users = [];
    for (const userData of demoUsers) {
        users.push(await upsertDemoUser(userData));
    }

    const usersByEmail = new Map(users.map((user) => [user.email, user]));
    const salesUsers = users.filter((user) => user.role === 'sales');
    const leads = [];
    for (const [index, row] of demoLeadRows.entries()) {
        const assignedUser = salesUsers[index % salesUsers.length];
        leads.push(await upsertDemoLead(row, assignedUser, index));
    }

    await AuditLog.deleteMany({ 'metadata.demoSeed': true });
    const auditEvents = buildDemoAuditEvents(usersByEmail, leads);
    await AuditLog.insertMany(auditEvents);

    console.log('Demo activity seed complete.');
    console.log('Login with these demo users:');
    users.forEach((user) => {
        console.log(`- ${user.email} / ${DEMO_PASSWORD} (${user.role})`);
    });
    console.log(`Demo leads ready: ${leads.length}`);
    console.log(`Demo activity events ready: ${auditEvents.length}`);
    console.log('Open /activity-report and test Today, Last 7 Days, Low activity users only, user/role/action filters, and Export CSV.');
}

seedActivityDemo()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
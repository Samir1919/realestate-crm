require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const { normalizePhoneNumber, isValidPhoneNumber } = require('../utils/phone');

async function normalizeLeadPhones() {
    await connectDB();

    const leads = await Lead.find({}, '_id phone customerName').lean();

    let updatedCount = 0;
    let unchangedCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (const lead of leads) {
        const currentPhone = String(lead.phone || '');
        const normalizedPhone = normalizePhoneNumber(currentPhone);

        if (!normalizedPhone || !isValidPhoneNumber(normalizedPhone)) {
            invalidCount += 1;
            console.log(`INVALID  ${lead._id}  ${lead.customerName || 'Unnamed'}  ${currentPhone}`);
            continue;
        }

        if (normalizedPhone === currentPhone) {
            unchangedCount += 1;
            continue;
        }

        const duplicateLead = await Lead.findOne({
            _id: { $ne: lead._id },
            phone: normalizedPhone
        }).select('_id customerName phone');

        if (duplicateLead) {
            duplicateCount += 1;
            console.log(
                `DUPLICATE ${lead._id} ${currentPhone} -> ${normalizedPhone} conflicts with ${duplicateLead._id} ${duplicateLead.phone}`
            );
            continue;
        }

        await Lead.updateOne({ _id: lead._id }, { $set: { phone: normalizedPhone } });
        updatedCount += 1;
        console.log(`UPDATED  ${lead._id}  ${currentPhone} -> ${normalizedPhone}`);
    }

    console.log('---');
    console.log(`Updated: ${updatedCount}`);
    console.log(`Unchanged: ${unchangedCount}`);
    console.log(`Invalid: ${invalidCount}`);
    console.log(`Duplicates skipped: ${duplicateCount}`);

    await mongoose.disconnect();
}

normalizeLeadPhones().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
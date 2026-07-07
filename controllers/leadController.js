const Lead = require('../models/Lead');
const User = require('../models/User');
const mongoose = require('mongoose');
const { canAccess } = require('../utils/permissions');

function getCurrentRole(req) {
    if (req.session && req.session.user && req.session.user.role) {
        return req.session.user.role;
    }
    return 'viewer';
}

function ensurePermission(req, res, permission) {
    const role = getCurrentRole(req);
    if (!canAccess(role, permission)) {
        res.status(403).send('You do not have permission to perform this action.');
        return false;
    }
    return true;
}

exports.getLeadsApi = async (req, res) => {
    try {
        const leads = await Lead.find()
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

        const query = {};

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
        const totalLeads = await Lead.countDocuments();
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
            userRole: getCurrentRole(req)
        });

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

        // একদম সেম নামে মডেলে পাস করা হলো
        const newLead = new Lead({
            customerName,
            phone,
            preferredLocation,
            propertyType,
            budgetMin: budgetMin ? Number(budgetMin) : 0,
            budgetMax: budgetMax ? Number(budgetMax) : 0,
            preferredSize,
            bedrooms: bedrooms ? Number(bedrooms) : 0,
            purpose,
            source,
            assignedUser: assignedUser || null,
            priority,
            status,
            followUpDate,
            messageNote
        });

        await newLead.save();
        res.redirect('/leads');

    } catch (err) {
        // ডুপ্লিকেট ফোন নম্বরের এরর হ্যান্ডেলিং
        if (err.code === 11000) {
            return res.status(400).send('এই ফোন নম্বরটি দিয়ে ইতিপূরণেই একটি লিড তৈরি করা হয়েছে!');
        }
        res.status(500).send(err.message);
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

        await Lead.findByIdAndUpdate(req.params.id, {
            customerName,
            phone,
            preferredLocation,
            propertyType,
            budgetMin: budgetMin ? Number(budgetMin) : 0,
            budgetMax: budgetMax ? Number(budgetMax) : 0,
            preferredSize,
            bedrooms: bedrooms ? Number(bedrooms) : 0,
            purpose,
            source,
            assignedUser: assignedUser || null,
            priority,
            status,
            followUpDate,
            messageNote
        });

        res.redirect('/leads'); // আপডেট শেষে মেইন পেজেই রিডাইরেক্ট হবে

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).send('এই ফোন নম্বরটি অন্য একটি লিডে ইতিমধ্যেই ব্যবহার করা হয়েছে!');
        }
        res.status(500).send(err.message);
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
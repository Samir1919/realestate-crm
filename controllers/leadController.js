const Lead = require('../models/Lead');

exports.getLeadsApi = async (req, res) => {
    try {
        const leads = await Lead.find().sort({ createdAt: -1 });

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
        // ১. কুয়েরি থেকে কারেন্ট পেজ নাম্বার নিন (ডিফল্ট পেজ ১)
        const page = parseInt(req.query.page) || 1;

        // ২. প্রতি পেজে কয়টি করে লিড দেখাতে চান তা সেট করুন
        const limit = 10;

        // ৩. কতগুলো ডাটা স্কিপ করতে হবে তার হিসাব
        const skip = (page - 1) * limit;

        // ৪. ডাটাবেজে মোট কতগুলো লিড আছে তা কাউন্ট করুন
        const totalLeads = await Lead.countDocuments();

        // 🔍 নির্দিষ্ট পেজের লিডগুলো নিয়ে আসুন (নতুন লিড সবার আগে থাকবে)
        const leads = await Lead.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // ৫. মোট কতগুলো পেজ তৈরি হবে তার হিসাব
        const totalPages = Math.ceil(totalLeads / limit);

        // 📤 ভিউ ফাইলে সব ভেরিয়েবল একসাথে পাস করুন
        res.render('leads', {
            leads,
            currentPage: page,
            totalPages,
            totalLeads,
            limit
        });

    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.addLead = async (req, res) => {
    try {
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
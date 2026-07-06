// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // .env থেকে MONGO_URI রিড করবে, না থাকলে ডকার মঙ্গোডিবি (27017) তে কানেক্ট হবে
        const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/realestate_crm';

        // নতুন Mongoose ভার্সনে অতিরিক্ত অপশন দেওয়ার প্রয়োজন নেই
        const conn = await mongoose.connect(dbURI);

        console.log(`🚀 MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Database Connection Error: ${error.message}`);
        process.exit(1); // কানেকশন ফেইল করলে প্রজেক্ট স্টপ করে দেবে
    }
};

module.exports = connectDB;


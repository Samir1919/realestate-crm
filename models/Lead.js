const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  // কাস্টমার সংক্রান্ত তথ্য
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    index: true,
    unique: true
  },

  // প্রপার্টি সংক্রান্ত তথ্য
  preferredLocation: {
    type: String,
    trim: true
  },
  propertyType: {
    type: String,
    required: [true, 'Property type is required'],
    enum: ['Land Share', 'Ready Flat', 'Land / Plot', 'Commercial', 'Upcoming Project']
  },
  budgetMin: {
    type: Number,
    default: 0
  },
  budgetMax: {
    type: Number,
    default: 0
  },
  preferredSize: {
    type: String, // e.g., "1200 sqft"
    trim: true
  },
  bedrooms: {
    type: Number,
    default: 0
  },

  // উদ্দেশ্য ও উৎস
  purpose: {
    type: String,
    enum: ['Own Living', 'Investment', 'Rental Income']
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: ['website', 'facebook', 'google', 'whatsapp', 'phone', 'referral', 'walk in']
  },

  // ইন্টারনাল ট্র্যাকিং ও স্ট্যাটাস
  priority: {
    type: String,
    enum: ['Hot', 'Warm', 'Cold'],
    default: 'Warm'
  },
  status: {
    type: String,
    enum: [
      'New', 'Contacted', 'Interested', 'Site Visit Scheduled', 
      'Site Visit Completed', 'Negotiation', 'Booking Pending', 
      'Booked', 'Payment Running', 'Sold', 'Lost'
    ],
    default: 'New'
  },
  
  // ফলো-আপ ও নোটস
  followUpDate: {
    type: Date
  },
  messageNote: {
    type: String,
    trim: true
  }
}, {
  timestamps: true // এর ফলে createdAt এবং updatedAt অটোমেটিক তৈরি হবে
});

const Lead = mongoose.model('Lead', LeadSchema);

module.exports = Lead;
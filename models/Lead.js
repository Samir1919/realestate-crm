const mongoose = require('mongoose');
const { formatLeadReference } = require('../utils/leadReference');
const LeadCounter = require('./LeadCounter');

const LeadSchema = new mongoose.Schema({
  referenceNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  leadNumber: {
    type: Number,
    unique: true,
    sparse: true
  },

  // কাস্টমার সংক্রান্ত তথ্য
  customerName: {
    type: String,
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
    default: 'whatsapp',
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
  },
  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true // এর ফলে createdAt এবং updatedAt অটোমেটিক তৈরি হবে
});

LeadSchema.pre('save', async function () {
  if (!this.isNew || this.referenceNumber) {
    return;
  }

  try {
    const existingCounter = await LeadCounter.findById('lead');

    if (!existingCounter) {
      const highestLead = await this.constructor
        .findOne({ leadNumber: { $exists: true } })
        .sort({ leadNumber: -1 })
        .select('leadNumber');

      const initialSeq = highestLead?.leadNumber || 0;
      await LeadCounter.findByIdAndUpdate(
        'lead',
        { $setOnInsert: { seq: initialSeq } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
    }

    const counter = await LeadCounter.findByIdAndUpdate(
      'lead',
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    this.leadNumber = counter.seq;
    this.referenceNumber = formatLeadReference(counter.seq, process.env.LEAD_REFERENCE_PREFIX || 'LD', 6);
  } catch (error) {
    throw error;
  }
});

const Lead = mongoose.model('Lead', LeadSchema);

module.exports = Lead;
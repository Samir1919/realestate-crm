const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    dueDate: { type: Date, required: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' } // Connected to a specific lead
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);
const Task = require('../models/Task');
const Lead = require('../models/Lead');

exports.getKanbanAndTasks = async (req, res) => {
    try {
        const leads = await Lead.find().sort({ updatedAt: -1 });
        const tasks = await Task.find().populate('leadId', 'name email').sort({ dueDate: 1 });

        if (req.path === '/') {
            res.render('index', { leads, tasks });
        } else {
            res.render('kanban', { leads, tasks });
        }
    } catch (err) {
        console.error(`❌ Error fetching Data: ${err.message}`);
        res.status(500).send('Internal Server Error');
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, dueDate, priority, leadId } = req.body;
        const newTask = new Task({
            title,
            description,
            dueDate,
            priority,
            leadId: leadId || null 
        });
        await newTask.save();
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Error creating task');
    }
};

exports.updateLeadStage = async (req, res) => {
    try {
        const { leadId, stage } = req.body;
        await Lead.findByIdAndUpdate(leadId, { stage: stage });
        
        await Lead.findByIdAndUpdate(leadId, {
            $push: { timeline: { activityType: 'Note', note: `System: Stage updated to "${stage}"` } }
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.toggleTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const task = await Task.findById(taskId);
        if (!task) return res.status(404).send('Task not found');

        task.status = task.status === 'Pending' ? 'Completed' : 'Pending';
        await task.save();

        res.redirect('/');
    } catch (err) {
        res.status(500).send('Error updating task');
    }
};
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const taskController = require('../controllers/taskController');

// Dashboard & Kanban
router.get('/', taskController.getKanbanAndTasks);
router.get('/kanban', taskController.getKanbanAndTasks);

// Leads API
router.get('/api/leads', leadController.getLeadsApi);

// Leads & Timeline
router.get('/leads', leadController.getLeads);
router.post('/leads', leadController.addLead);
router.post('/leads/update/:id', leadController.updateLead);
router.post('/leads/delete/:id', leadController.deleteLead);

router.post('/leads/update-stage', taskController.updateLeadStage);
router.post('/leads/activity', leadController.addTimelineActivity);

// Tasks
router.post('/tasks/create', taskController.createTask);
router.post('/tasks/:taskId/toggle', taskController.toggleTaskStatus);



module.exports = router;
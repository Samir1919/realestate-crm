const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { canAccess } = require('../utils/permissions');

function attachRole(req, res, next) {
    req.userRole = req.session && req.session.user && req.session.user.role
        ? req.session.user.role
        : 'viewer';
    next();
}

router.use(attachRole);

function requireRoutePermission(permissionKey) {
    return (req, res, next) => {
        const role = req.session?.user?.role || 'viewer';
        if (!canAccess(role, permissionKey)) {
            return res.status(403).send('Permission denied');
        }
        next();
    };
}

// Dashboard
router.get('/', leadController.getDashboard);

// Leads API
router.get('/api/leads', requireRoutePermission('viewLeads'), leadController.getLeadsApi);

// Leads & Timeline
router.get('/leads', leadController.getLeads);
router.post('/leads', leadController.addLead);
router.get('/leads/export.csv', leadController.exportLeadsCsv);
router.post('/leads/import', leadController.importLeadsCsv);
router.post('/leads/update/:id', leadController.updateLead);
router.post('/leads/request-inactive/:id', leadController.requestLeadInactive);
router.post('/leads/delete/:id', leadController.deleteLead);
router.post('/leads/reject-inactive/:id', leadController.rejectLeadInactiveRequest);
router.post('/leads/restore/:id', leadController.restoreLead);

router.post('/leads/activity', requireRoutePermission('updateLead'), leadController.addTimelineActivity);



module.exports = router;
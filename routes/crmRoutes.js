const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const activityReportController = require('../controllers/activityReportController');
const { requirePermissionPolicy, requireLeadPolicy } = require('../middleware/policy');
const { registerLeadRoutes } = require('./leadsRoutes');
const { registerLeadApiRoutes } = require('./leadsApiRoutes');

function attachRole(req, res, next) {
    req.userRole = req.session && req.session.user && req.session.user.role
        ? req.session.user.role
        : 'viewer';
    next();
}

router.use(attachRole);

// Dashboard
router.get('/', leadController.getDashboard);
router.get('/activity-report', requirePermissionPolicy('reports.activity.view'), activityReportController.getActivityReport);
router.get('/activity-report/export.csv', requirePermissionPolicy('reports.activity.view'), activityReportController.exportActivityReportCsv);

registerLeadApiRoutes(router, {
    leadController,
    requireLeadPolicy
});

registerLeadRoutes(router, {
    leadController,
    requireLeadPolicy,
    requirePermissionPolicy
});



module.exports = router;
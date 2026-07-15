const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { canAccess } = require('../utils/permissions');
const { registerLeadRoutes } = require('./leadsRoutes');
const { registerLeadApiRoutes } = require('./leadsApiRoutes');

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

registerLeadApiRoutes(router, {
    leadController,
    requireRoutePermission
});

registerLeadRoutes(router, {
    leadController,
    requireRoutePermission
});



module.exports = router;
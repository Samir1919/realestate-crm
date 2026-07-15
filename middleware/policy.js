const mongoose = require('mongoose');
const { canAccess } = require('../utils/permissions');
const { requireCapability } = require('./capabilityPolicy');

const LEAD_POLICY_MATRIX = {
    view: {
        all: 'leads.view.all',
        own: 'leads.view.own',
        legacy: 'viewLeads'
    },
    create: {
        all: 'leads.create.all',
        own: 'leads.create.own',
        legacy: 'createLead'
    },
    update: {
        all: 'leads.update.all',
        own: 'leads.update.own',
        legacy: 'updateLead'
    },
    delete: {
        all: 'leads.delete.all',
        own: 'leads.delete.own',
        legacy: 'deleteLead'
    }
};

function getSessionRole(req) {
    return String(req.session?.user?.role || 'viewer').trim().toLowerCase();
}

function getSessionUserId(req) {
    return String(req.session?.user?.id || '').trim();
}

function resolveLeadPolicy(req, action) {
    const matrix = LEAD_POLICY_MATRIX[action];
    if (!matrix) {
        return {
            allowed: false,
            ownership: 'none',
            scope: null
        };
    }

    const role = getSessionRole(req);
    if (canAccess(role, matrix.all)) {
        return {
            allowed: true,
            ownership: 'all',
            scope: {}
        };
    }

    const userId = getSessionUserId(req);
    const hasOwnPermission = canAccess(role, matrix.own) || canAccess(role, matrix.legacy);
    if (hasOwnPermission && mongoose.Types.ObjectId.isValid(userId)) {
        return {
            allowed: true,
            ownership: 'own',
            scope: {
                assignedUser: new mongoose.Types.ObjectId(userId)
            }
        };
    }

    return {
        allowed: false,
        ownership: 'none',
        scope: null
    };
}

function requirePermissionPolicy(permissionKey) {
    return requireCapability(permissionKey);
}

function requireLeadPolicy(action) {
    return (req, res, next) => {
        const resolved = resolveLeadPolicy(req, action);
        if (!resolved.allowed) {
            return res.status(403).send('Permission denied');
        }

        req.leadPolicy = req.leadPolicy || {};
        req.leadPolicy[action] = resolved;
        next();
    };
}

module.exports = {
    LEAD_POLICY_MATRIX,
    resolveLeadPolicy,
    requirePermissionPolicy,
    requireLeadPolicy
};
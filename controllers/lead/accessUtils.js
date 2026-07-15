const mongoose = require('mongoose');
const { canAccess } = require('../../utils/permissions');

function getCurrentRole(req) {
    if (req.session && req.session.user && req.session.user.role) {
        return req.session.user.role;
    }
    return 'viewer';
}

function getCurrentUserId(req) {
    if (!req.session || !req.session.user || !req.session.user.id) {
        return null;
    }

    return String(req.session.user.id);
}

function getCurrentUserName(req) {
    if (!req.session || !req.session.user || !req.session.user.name) {
        return 'Unknown User';
    }

    return String(req.session.user.name);
}

function buildLeadScopeQuery(req) {
    const role = getCurrentRole(req).toLowerCase();
    const userId = getCurrentUserId(req);

    if (role === 'sales' && userId && mongoose.Types.ObjectId.isValid(userId)) {
        return {
            assignedUser: new mongoose.Types.ObjectId(userId)
        };
    }

    return {};
}

function ensurePermission(req, res, permission) {
    const role = getCurrentRole(req);
    if (!canAccess(role, permission)) {
        res.status(403).send('You do not have permission to perform this action.');
        return false;
    }
    return true;
}

function isAjaxRequest(req) {
    const accepts = String(req.headers.accept || '');
    return req.xhr || accepts.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest';
}

function sendLeadFormSuccess(req, res, message) {
    if (isAjaxRequest(req)) {
        return res.status(200).json({
            success: true,
            message
        });
    }

    return res.redirect('/leads');
}

function sendLeadFormError(req, res, statusCode, message) {
    if (isAjaxRequest(req)) {
        return res.status(statusCode).json({
            success: false,
            message
        });
    }

    return res.status(statusCode).send(message);
}

module.exports = {
    getCurrentRole,
    getCurrentUserId,
    getCurrentUserName,
    buildLeadScopeQuery,
    ensurePermission,
    sendLeadFormSuccess,
    sendLeadFormError
};

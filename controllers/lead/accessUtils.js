const { canAccess } = require('../../utils/permissions');
const { resolveLeadPolicy } = require('../../middleware/policy');

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

function buildLeadScopeQuery(req, action = 'view') {
    const cachedPolicy = req.leadPolicy && req.leadPolicy[action];
    if (cachedPolicy) {
        return cachedPolicy.scope;
    }

    const resolved = resolveLeadPolicy(req, action);
    if (!resolved.allowed) {
        return null;
    }

    req.leadPolicy = req.leadPolicy || {};
    req.leadPolicy[action] = resolved;
    return resolved.scope;
}

function ensurePermission(req, res, permission) {
    const role = getCurrentRole(req);
    if (!canAccess(role, permission)) {
        res.status(403).send('You do not have permission to perform this action.');
        return false;
    }
    return true;
}

function ensureLeadPolicy(req, res, action) {
    const scope = buildLeadScopeQuery(req, action);
    if (scope === null) {
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
    ensureLeadPolicy,
    sendLeadFormSuccess,
    sendLeadFormError
};

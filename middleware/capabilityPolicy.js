const { canAccess } = require('../utils/permissions');

function getSessionRole(req) {
    return String(req.session?.user?.role || 'viewer').trim().toLowerCase();
}

function requireCapability(capabilityKey) {
    const normalizedCapability = String(capabilityKey || '').trim().toLowerCase();

    return (req, res, next) => {
        const role = getSessionRole(req);
        if (!normalizedCapability || !canAccess(role, normalizedCapability)) {
            return res.status(403).send('Permission denied');
        }

        next();
    };
}

module.exports = {
    requireCapability,
    getSessionRole
};

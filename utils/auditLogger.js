const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

function resolveActorId(req) {
    const rawId = req.session?.user?.id;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
        return null;
    }

    return new mongoose.Types.ObjectId(String(rawId));
}

function resolveIpAddress(req) {
    return String(req.ip || req.socket?.remoteAddress || '').trim();
}

async function logAuditEvent(req, event) {
    try {
        if (!event || !event.action) {
            return;
        }

        await AuditLog.create({
            action: String(event.action).trim(),
            actorId: resolveActorId(req),
            actorEmail: String(req.session?.user?.email || '').trim().toLowerCase(),
            actorRole: String(req.session?.user?.role || '').trim().toLowerCase(),
            targetType: String(event.targetType || '').trim(),
            targetId: String(event.targetId || '').trim(),
            success: Boolean(event.success !== false),
            ipAddress: resolveIpAddress(req),
            userAgent: String(req.get('user-agent') || '').trim(),
            metadata: event.metadata || {}
        });
    } catch (err) {
        console.error('Audit logging failed:', err.message);
    }
}

module.exports = {
    logAuditEvent,
    __testables: {
        resolveIpAddress
    }
};

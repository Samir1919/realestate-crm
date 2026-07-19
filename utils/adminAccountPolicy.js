function sameId(first, second) {
    return Boolean(first && second && String(first) === String(second));
}

function getRoleChangeDenial({ actorId, targetId, currentRole, nextRole, adminCount }) {
    if (String(currentRole || '').toLowerCase() !== 'admin' || String(nextRole || '').toLowerCase() === 'admin') {
        return null;
    }

    if (sameId(actorId, targetId)) {
        return 'self_demotion';
    }

    if (Number(adminCount) <= 1) {
        return 'last_admin';
    }

    return null;
}

function getDeletionDenial({ actorId, targetId, targetRole, adminCount }) {
    if (sameId(actorId, targetId)) {
        return 'self_deletion';
    }

    if (String(targetRole || '').toLowerCase() === 'admin' && Number(adminCount) <= 1) {
        return 'last_admin';
    }

    return null;
}

module.exports = {
    getDeletionDenial,
    getRoleChangeDenial
};

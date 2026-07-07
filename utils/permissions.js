const Role = require('../models/Role');
const Permission = require('../models/Permission');

const ROLE_PERMISSIONS = {
    admin: ['viewLeads', 'createLead', 'updateLead', 'deleteLead', 'manageUsers', 'manageRoles'],
    sales: ['viewLeads', 'createLead', 'updateLead'],
    viewer: ['viewLeads']
};

const PERMISSION_CATALOG = {
    viewLeads: 'Can view leads list',
    createLead: 'Can create lead',
    updateLead: 'Can edit lead',
    deleteLead: 'Can delete lead',
    manageUsers: 'Can manage users and assignments',
    manageRoles: 'Can manage roles and permissions'
};

let rolePermissionCache = null;

function normalizePermissionKey(permission) {
    return String(permission || '').trim().toLowerCase();
}

function normalizePermissionsList(permissions) {
    return (permissions || []).map((permission) => normalizePermissionKey(permission));
}

function buildDefaultPermissionsCache() {
    return Object.entries(ROLE_PERMISSIONS).reduce((acc, [roleName, permissions]) => {
        acc[roleName] = normalizePermissionsList(permissions);
        return acc;
    }, {});
}

async function ensureDefaultAccessData() {
    const permissionEntries = Object.entries(PERMISSION_CATALOG).map(([key, description]) => ({
        key,
        description,
        system: true
    }));

    for (const entry of permissionEntries) {
        await Permission.findOneAndUpdate(
            { key: entry.key },
            { $setOnInsert: entry },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
    }

    for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        await Role.findOneAndUpdate(
            { name },
            { $setOnInsert: { name, permissions, system: true } },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
    }
}

async function refreshPermissionsCache() {
    const roles = await Role.find().select('name permissions').lean();
    if (!roles.length) {
        rolePermissionCache = buildDefaultPermissionsCache();
        return rolePermissionCache;
    }

    rolePermissionCache = roles.reduce((acc, role) => {
        acc[role.name] = normalizePermissionsList(role.permissions);
        return acc;
    }, {});

    return rolePermissionCache;
}

function canAccess(role, permission) {
    const normalizedRole = (role || 'viewer').toLowerCase();
    const normalizedPermission = normalizePermissionKey(permission);

    if (rolePermissionCache && Object.keys(rolePermissionCache).length > 0) {
        const permissions = rolePermissionCache[normalizedRole] || [];
        return permissions.includes(normalizedPermission);
    }

    const fallbackPermissions = normalizePermissionsList(ROLE_PERMISSIONS[normalizedRole] || []);
    return fallbackPermissions.includes(normalizedPermission);
}

function requirePermission(role, permission) {
    return canAccess(role, permission);
}

module.exports = {
    ROLE_PERMISSIONS,
    PERMISSION_CATALOG,
    canAccess,
    requirePermission,
    ensureDefaultAccessData,
    refreshPermissionsCache
};

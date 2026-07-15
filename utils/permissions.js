const Role = require('../models/Role');
const Permission = require('../models/Permission');

const ROLE_PERMISSIONS = {
    admin: [
        'leads.view.all',
        'leads.create.all',
        'leads.update.all',
        'leads.delete.all',
        'users.manage',
        'users.assignrole',
        'roles.manage'
    ],
    sales: ['leads.view.own', 'leads.create.own', 'leads.update.own'],
    viewer: ['leads.view.all']
};

const PERMISSION_CATALOG = {
    'leads.view.all': 'Can view all leads',
    'leads.view.own': 'Can view only assigned leads',
    'leads.create.all': 'Can create leads globally',
    'leads.create.own': 'Can create leads for own scope',
    'leads.update.all': 'Can update any lead',
    'leads.update.own': 'Can update own assigned leads',
    'leads.delete.all': 'Can archive or restore any lead',
    'leads.delete.own': 'Can archive or restore own assigned leads',
    'users.manage': 'Can manage users',
    'users.assignrole': 'Can assign role to users',
    'roles.manage': 'Can manage roles and permissions'
};

const LEGACY_PERMISSION_ALIASES = {
    viewleads: ['leads.view.all', 'leads.view.own'],
    createlead: ['leads.create.all', 'leads.create.own'],
    updatelead: ['leads.update.all', 'leads.update.own'],
    deletelead: ['leads.delete.all', 'leads.delete.own'],
    manageusers: ['users.manage'],
    manageroles: ['roles.manage'],
    assignrole: ['users.assignrole']
};

const STORAGE_COMPATIBILITY_ALIASES = {
    'leads.view.own': ['viewleads'],
    'leads.create.own': ['createlead'],
    'leads.update.own': ['updatelead'],
    'leads.delete.own': ['deletelead'],
    'users.manage': ['manageusers'],
    'roles.manage': ['manageroles'],
    'users.assignrole': ['assignrole']
};

const LEGACY_PERMISSION_KEYS = ['viewLeads', 'createLead', 'updateLead', 'deleteLead', 'manageUsers', 'manageRoles', 'assignRole'];
const LEGACY_CATALOG_PERMISSION_KEYS = ['viewleads', 'createlead', 'updatelead', 'deletelead', 'manageusers', 'manageroles', 'assignrole'];

let rolePermissionCache = null;

function normalizePermissionKey(permission) {
    return String(permission || '').trim().toLowerCase();
}

function normalizePermissionsList(permissions) {
    return Array.from(new Set((permissions || []).map((permission) => normalizePermissionKey(permission)).filter(Boolean)));
}

function expandRequestedPermissions(permission) {
    const normalizedPermission = normalizePermissionKey(permission);
    const candidates = new Set([normalizedPermission]);

    const canonicalAliases = LEGACY_PERMISSION_ALIASES[normalizedPermission] || [];
    canonicalAliases.forEach((alias) => candidates.add(alias));

    return Array.from(candidates);
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
    const requestedPermissions = expandRequestedPermissions(permission);

    if (rolePermissionCache && Object.keys(rolePermissionCache).length > 0) {
        const permissions = rolePermissionCache[normalizedRole] || [];
        const hasDirectMatch = requestedPermissions.some((requestedPermission) => permissions.includes(requestedPermission));
        if (hasDirectMatch) {
            return true;
        }

        return requestedPermissions.some((requestedPermission) => {
            const compatibilityAliases = STORAGE_COMPATIBILITY_ALIASES[requestedPermission] || [];
            return compatibilityAliases.some((alias) => permissions.includes(alias));
        });
    }

    const fallbackPermissions = normalizePermissionsList(ROLE_PERMISSIONS[normalizedRole] || []);
    const hasFallbackDirectMatch = requestedPermissions.some((requestedPermission) => fallbackPermissions.includes(requestedPermission));
    if (hasFallbackDirectMatch) {
        return true;
    }

    return requestedPermissions.some((requestedPermission) => {
        const compatibilityAliases = STORAGE_COMPATIBILITY_ALIASES[requestedPermission] || [];
        return compatibilityAliases.some((alias) => fallbackPermissions.includes(alias));
    });
}

function requirePermission(role, permission) {
    return canAccess(role, permission);
}

function isLegacyPermissionKey(permissionKey) {
    const normalizedPermission = normalizePermissionKey(permissionKey);
    return LEGACY_CATALOG_PERMISSION_KEYS.includes(normalizedPermission);
}

module.exports = {
    ROLE_PERMISSIONS,
    PERMISSION_CATALOG,
    LEGACY_PERMISSION_KEYS,
    LEGACY_CATALOG_PERMISSION_KEYS,
    canAccess,
    requirePermission,
    isLegacyPermissionKey,
    ensureDefaultAccessData,
    refreshPermissionsCache
};

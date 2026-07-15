require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Role = require('../models/Role');
const { refreshPermissionsCache } = require('../utils/permissions');

const SYSTEM_ROLE_LEGACY_PERMISSIONS = {
    admin: ['viewleads', 'createlead', 'updatelead', 'deletelead', 'manageusers', 'manageroles'],
    sales: ['viewleads', 'createlead', 'updatelead'],
    viewer: ['viewleads']
};

const TAXONOMY_TO_LEGACY = {
    'leads.view.all': 'viewleads',
    'leads.view.own': 'viewleads',
    'leads.create.all': 'createlead',
    'leads.create.own': 'createlead',
    'leads.update.all': 'updatelead',
    'leads.update.own': 'updatelead',
    'leads.delete.all': 'deletelead',
    'leads.delete.own': 'deletelead',
    'users.manage': 'manageusers',
    'users.assignrole': 'manageusers',
    'roles.manage': 'manageroles'
};

function normalizePermissionKey(permission) {
    return String(permission || '').trim().toLowerCase();
}

function asUniqueList(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
}

function isSystemRoleName(roleName) {
    return Object.prototype.hasOwnProperty.call(SYSTEM_ROLE_LEGACY_PERMISSIONS, roleName);
}

function mapPermissionToLegacy(permissionKey) {
    const normalized = normalizePermissionKey(permissionKey);
    if (!normalized) {
        return [];
    }

    const mapped = TAXONOMY_TO_LEGACY[normalized];
    if (mapped) {
        return [mapped];
    }

    // Keep custom keys untouched.
    return [normalized];
}

function normalizeSystemRolePermissionsToLegacy(roleName) {
    return asUniqueList(SYSTEM_ROLE_LEGACY_PERMISSIONS[roleName] || []);
}

async function rollbackRolePermissions({ applyChanges }) {
    await connectDB();

    const roles = await Role.find().select('name permissions').sort({ name: 1 });

    let changedRoles = 0;
    let unchangedRoles = 0;

    for (const role of roles) {
        const roleName = normalizePermissionKey(role.name);
        const currentPermissions = asUniqueList((role.permissions || []).map((item) => normalizePermissionKey(item)));

        const mappedPermissions = asUniqueList(currentPermissions.flatMap(mapPermissionToLegacy));
        const finalPermissions = isSystemRoleName(roleName)
            ? normalizeSystemRolePermissionsToLegacy(roleName)
            : mappedPermissions;

        const isChanged = JSON.stringify(currentPermissions) !== JSON.stringify(finalPermissions);

        if (!isChanged) {
            unchangedRoles += 1;
            continue;
        }

        changedRoles += 1;
        console.log(`ROLE ${role.name}`);
        console.log(`  from: ${JSON.stringify(currentPermissions)}`);
        console.log(`  to  : ${JSON.stringify(finalPermissions)}`);

        if (applyChanges) {
            role.permissions = finalPermissions;
            await role.save();
            console.log('  status: updated');
        } else {
            console.log('  status: dry-run (no write)');
        }
    }

    if (applyChanges) {
        await refreshPermissionsCache();
    }

    console.log('---');
    console.log(`Roles scanned: ${roles.length}`);
    console.log(`Roles changed: ${changedRoles}`);
    console.log(`Roles unchanged: ${unchangedRoles}`);
    console.log(`Mode: ${applyChanges ? 'apply' : 'dry-run'}`);
}

async function main() {
    const applyChanges = process.argv.includes('--apply');
    await rollbackRolePermissions({ applyChanges });
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});

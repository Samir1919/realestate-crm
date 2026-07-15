require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Role = require('../models/Role');
const {
    PERMISSION_CATALOG,
    ROLE_PERMISSIONS,
    ensureDefaultAccessData,
    refreshPermissionsCache
} = require('../utils/permissions');

const LEGACY_TO_TAXONOMY = {
    viewleads: ['leads.view.all', 'leads.view.own'],
    createlead: ['leads.create.all', 'leads.create.own'],
    updatelead: ['leads.update.all', 'leads.update.own'],
    deletelead: ['leads.delete.all', 'leads.delete.own'],
    manageusers: ['users.manage'],
    manageroles: ['roles.manage'],
    assignrole: ['users.assignrole']
};

function normalizePermissionKey(permission) {
    return String(permission || '').trim().toLowerCase();
}

function asUniqueList(items) {
    return Array.from(new Set(items.filter(Boolean)));
}

function isSystemRoleName(roleName) {
    return Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, roleName);
}

function mapPermissionToTaxonomy(permissionKey, knownPermissions) {
    const normalized = normalizePermissionKey(permissionKey);
    if (!normalized) {
        return [];
    }

    const mapped = LEGACY_TO_TAXONOMY[normalized] || [];
    if (mapped.length > 0) {
        return mapped;
    }

    if (knownPermissions.has(normalized)) {
        return [normalized];
    }

    // Keep custom permission keys untouched if they exist in catalog or DB.
    return [normalized];
}

function normalizeSystemRolePermissions(roleName, permissions) {
    const baseline = ROLE_PERMISSIONS[roleName] || [];
    return asUniqueList(baseline.map((item) => normalizePermissionKey(item)));
}

async function loadKnownPermissionKeys() {
    const dbPermissionDocs = await mongoose.model('Permission').find().select('key').lean();
    const fromDb = dbPermissionDocs.map((item) => normalizePermissionKey(item.key));
    const fromCatalog = Object.keys(PERMISSION_CATALOG).map((item) => normalizePermissionKey(item));

    return new Set([...fromDb, ...fromCatalog]);
}

async function normalizeRolePermissions({ applyChanges }) {
    await connectDB();
    await ensureDefaultAccessData();

    const knownPermissions = await loadKnownPermissionKeys();
    const roles = await Role.find().select('name permissions system').sort({ name: 1 });

    let changedRoles = 0;
    let unchangedRoles = 0;

    for (const role of roles) {
        const roleName = normalizePermissionKey(role.name);
        const currentPermissions = asUniqueList((role.permissions || []).map((item) => normalizePermissionKey(item)));

        const mappedPermissions = asUniqueList(
            currentPermissions.flatMap((permission) => mapPermissionToTaxonomy(permission, knownPermissions))
        );

        const finalPermissions = isSystemRoleName(roleName)
            ? normalizeSystemRolePermissions(roleName, mappedPermissions)
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
    await normalizeRolePermissions({ applyChanges });
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});

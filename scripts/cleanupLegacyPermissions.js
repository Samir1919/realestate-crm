require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const { LEGACY_CATALOG_PERMISSION_KEYS, refreshPermissionsCache } = require('../utils/permissions');

async function cleanupLegacyPermissions({ applyChanges }) {
    await connectDB();

    const legacyPermissions = await Permission.find({ key: { $in: LEGACY_CATALOG_PERMISSION_KEYS } })
        .select('key system')
        .sort({ key: 1 })
        .lean();

    const legacyKeysFound = legacyPermissions.map((item) => item.key);
    if (!legacyKeysFound.length) {
        console.log('No legacy permissions found.');
    } else {
        console.log(`Legacy permissions found: ${JSON.stringify(legacyKeysFound)}`);
    }

    const rolesWithLegacyKeys = await Role.find({ permissions: { $in: LEGACY_CATALOG_PERMISSION_KEYS } })
        .select('name permissions')
        .sort({ name: 1 })
        .lean();

    if (!rolesWithLegacyKeys.length) {
        console.log('No roles contain legacy permissions.');
    } else {
        console.log('Roles containing legacy permissions:');
        rolesWithLegacyKeys.forEach((role) => {
            const legacyKeys = (role.permissions || []).filter((permission) => LEGACY_CATALOG_PERMISSION_KEYS.includes(String(permission).toLowerCase()));
            console.log(`  - ${role.name}: ${JSON.stringify(legacyKeys)}`);
        });
    }

    if (!applyChanges) {
        console.log('Mode: dry-run');
        return;
    }

    if (legacyKeysFound.length) {
        const deleteResult = await Permission.deleteMany({ key: { $in: LEGACY_CATALOG_PERMISSION_KEYS } });
        console.log(`Deleted legacy permission docs: ${deleteResult.deletedCount}`);
    }

    if (rolesWithLegacyKeys.length) {
        const updateResult = await Role.updateMany(
            { permissions: { $in: LEGACY_CATALOG_PERMISSION_KEYS } },
            { $pull: { permissions: { $in: LEGACY_CATALOG_PERMISSION_KEYS } } }
        );
        console.log(`Updated roles (legacy permissions pulled): ${updateResult.modifiedCount}`);
    }

    await refreshPermissionsCache();
    console.log('Mode: apply');
}

async function main() {
    const applyChanges = process.argv.includes('--apply');
    await cleanupLegacyPermissions({ applyChanges });
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});

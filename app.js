require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const { createSessionConfig } = require('./config/session');
const crmRoutes = require('./routes/crmRoutes');
const adminUsersRoutes = require('./routes/adminUsersRoutes');
const User = require('./models/User');
const Role = require('./models/Role');
const Permission = require('./models/Permission');
const { requireCapability } = require('./middleware/capabilityPolicy');
const { csrfProtection } = require('./middleware/csrfProtection');
const { logAuditEvent } = require('./utils/auditLogger');
const {
    canAccess,
    ROLE_PERMISSIONS,
    PERMISSION_CATALOG,
    LEGACY_PERMISSION_KEYS,
    LEGACY_CATALOG_PERMISSION_KEYS,
    isLegacyPermissionKey,
    ensureDefaultAccessData,
    refreshPermissionsCache
} = require('./utils/permissions');

const app = express();

// Database Connection
connectDB();

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

async function ensureInitialAdminUser() {
    const adminExists = await User.exists({ role: 'admin' });
    if (adminExists) {
        return;
    }

    const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@crm.com').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || '123456').trim();
    const adminName = String(process.env.ADMIN_NAME || 'Admin User').trim() || 'Admin User';

    const configuredUser = await User.findOne({ email: adminEmail });
    if (configuredUser) {
        configuredUser.role = 'admin';
        await configuredUser.save();
        console.log(`✅ Promoted existing user to admin: ${adminEmail}`);
        return;
    }

    await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
    });

    console.log(`✅ Created initial admin user: ${adminEmail}`);
}

// Seed core roles/permissions and warm cache
ensureDefaultAccessData()
    .then(refreshPermissionsCache)
    .then(ensureInitialAdminUser)
    .catch((err) => console.error('Failed to initialize access data:', err.message));

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session(createSessionConfig()));
app.use(csrfProtection);

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    const currentRole = req.session?.user?.role || 'viewer';
    res.locals.currentRole = currentRole;
    const permissionKeysForView = Array.from(new Set([
        ...Object.keys(PERMISSION_CATALOG),
        ...LEGACY_PERMISSION_KEYS
    ]));

    res.locals.permissions = permissionKeysForView.reduce((acc, permissionKey) => {
        const hasPermission = canAccess(currentRole, permissionKey);
        acc[permissionKey] = hasPermission;
        acc[String(permissionKey).toLowerCase()] = hasPermission;
        return acc;
    }, {});
    next();
});

app.get('/login', (req, res) => {
    res.render('auth/login', { error: null });
});

app.post('/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const user = await User.findOne({ email });
        let isPasswordValid = false;

        if (user) {
            const storedPassword = String(user.password || '');
            const isBcryptHash = storedPassword.startsWith('$2');

            if (isBcryptHash) {
                isPasswordValid = await user.comparePassword(password);
            } else {
                isPasswordValid = storedPassword === password;

                if (isPasswordValid) {
                    // Auto-upgrade legacy plaintext password to bcrypt hash.
                    user.password = await bcrypt.hash(password, 12);
                    await user.save();
                }
            }
        }

        if (!user || !isPasswordValid) {
            await logAuditEvent(req, {
                action: 'auth.login',
                success: false,
                targetType: 'user',
                metadata: {
                    attemptedEmail: email,
                    reason: 'invalid_credentials'
                }
            });
            return res.status(401).render('auth/login', { error: 'Invalid credentials' });
        }

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        await logAuditEvent(req, {
            action: 'auth.login',
            success: true,
            targetType: 'user',
            targetId: String(user._id),
            metadata: {
                email: user.email,
                role: user.role
            }
        });

        res.redirect('/');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'auth.login',
            success: false,
            targetType: 'user',
            metadata: {
                attemptedEmail: String(req.body.email || '').trim().toLowerCase(),
                reason: 'server_error',
                error: err.message
            }
        });
        res.status(500).render('auth/login', { error: err.message });
    }
});

app.get('/logout', (req, res) => {
    const actorId = String(req.session?.user?.id || '').trim();
    const actorEmail = String(req.session?.user?.email || '').trim().toLowerCase();
    const actorRole = String(req.session?.user?.role || '').trim().toLowerCase();

    logAuditEvent(req, {
        action: 'auth.logout',
        success: true,
        targetType: 'user',
        targetId: actorId,
        metadata: {
            email: actorEmail,
            role: actorRole
        }
    });

    req.session.destroy(() => {
        res.clearCookie(process.env.SESSION_COOKIE_NAME || 'crm.sid');
        res.redirect('/login');
    });
});

app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'production') {
    app.get('/seed-user', async (req, res) => {
        try {
            const existing = await User.findOne({ email: 'admin@crm.com' });
            if (!existing) {
                await User.create({
                    name: 'Admin User',
                    email: 'admin@crm.com',
                    password: '123456',
                    role: 'admin'
                });
            }

            res.send('Seeded admin account: admin@crm.com / 123456');
        } catch (err) {
            res.status(500).send(err.message);
        }
    });
}

app.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/logout') {
        return next();
    }
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
});

app.use(adminUsersRoutes);

app.get('/admin/roles', requireCapability('roles.manage'), async (req, res) => {
    try {
        await ensureDefaultAccessData();
        await refreshPermissionsCache();

        const [roles, permissionCatalog] = await Promise.all([
            Role.find().sort({ name: 1 }).lean(),
            Permission.find({ key: { $nin: LEGACY_CATALOG_PERMISSION_KEYS } }).sort({ key: 1 }).lean()
        ]);

        res.render('admin/roles', {
            roles,
            permissionCatalog,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/admin/roles/create', requireCapability('roles.manage'), async (req, res) => {
    try {
        const name = (req.body.name || '').trim().toLowerCase();
        if (!name) {
            return res.redirect('/admin/roles?error=Role%20name%20is%20required');
        }

        if (!/^[a-z0-9_-]+$/.test(name)) {
            return res.redirect('/admin/roles?error=Role%20name%20format%20is%20invalid');
        }

        const exists = await Role.findOne({ name });
        if (exists) {
            return res.redirect('/admin/roles?error=Role%20already%20exists');
        }

        await Role.create({ name, permissions: [] });
        await refreshPermissionsCache();

        await logAuditEvent(req, {
            action: 'roles.create',
            success: true,
            targetType: 'role',
            targetId: name,
            metadata: {
                roleName: name
            }
        });

        res.redirect('/admin/roles?success=Role%20created');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'roles.create',
            success: false,
            targetType: 'role',
            targetId: String(req.body.name || '').trim().toLowerCase(),
            metadata: {
                error: err.message
            }
        });

        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/roles/:id/update', requireCapability('roles.manage'), async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.redirect('/admin/roles?error=Role%20not%20found');
        }

        const newName = (req.body.name || '').trim().toLowerCase();
        if (!newName || !/^[a-z0-9_-]+$/.test(newName)) {
            return res.redirect('/admin/roles?error=Role%20name%20format%20is%20invalid');
        }

        if (role.system && role.name === 'admin' && newName !== 'admin') {
            return res.redirect('/admin/roles?error=System%20admin%20role%20name%20cannot%20change');
        }

        const duplicate = await Role.findOne({ _id: { $ne: role._id }, name: newName });
        if (duplicate) {
            return res.redirect('/admin/roles?error=Role%20name%20already%20used');
        }

        const oldName = role.name;
        role.name = newName;
        await role.save();

        await User.updateMany({ role: oldName }, { $set: { role: newName } });
        if (req.session.user && req.session.user.role === oldName) {
            req.session.user.role = newName;
        }

        await refreshPermissionsCache();

        await logAuditEvent(req, {
            action: 'roles.update',
            success: true,
            targetType: 'role',
            targetId: String(role._id),
            metadata: {
                oldName,
                newName
            }
        });

        res.redirect('/admin/roles?success=Role%20updated');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'roles.update',
            success: false,
            targetType: 'role',
            targetId: String(req.params.id || ''),
            metadata: {
                attemptedName: String(req.body.name || '').trim().toLowerCase(),
                error: err.message
            }
        });

        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/roles/:id/delete', requireCapability('roles.manage'), async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.redirect('/admin/roles?error=Role%20not%20found');
        }

        if (role.system || role.name === 'admin' || role.name === 'viewer') {
            return res.redirect('/admin/roles?error=System%20roles%20cannot%20be%20deleted');
        }

        await Role.findByIdAndDelete(role._id);
        await User.updateMany({ role: role.name }, { $set: { role: 'viewer' } });
        await ensureDefaultAccessData();
        await refreshPermissionsCache();

        await logAuditEvent(req, {
            action: 'roles.delete',
            success: true,
            targetType: 'role',
            targetId: String(role._id),
            metadata: {
                deletedRoleName: role.name
            }
        });

        res.redirect('/admin/roles?success=Role%20deleted');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'roles.delete',
            success: false,
            targetType: 'role',
            targetId: String(req.params.id || ''),
            metadata: {
                error: err.message
            }
        });

        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/roles/:id/permissions', requireCapability('roles.manage'), async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.redirect('/admin/roles?error=Role%20not%20found');
        }

        let selectedPermissions = req.body.permissions || [];
        if (!Array.isArray(selectedPermissions)) {
            selectedPermissions = [selectedPermissions];
        }

        const normalizedSelectedPermissions = selectedPermissions
            .map((permission) => String(permission || '').trim().toLowerCase())
            .filter(Boolean);

        const activeRole = String(req.session?.user?.role || '').trim().toLowerCase();

        // Protect against self-lockout: active role cannot lose manageRoles or viewLeads.
        if (activeRole && activeRole === role.name) {
            const hasManageRoles = normalizedSelectedPermissions.includes('roles.manage');
            const hasViewLeads = normalizedSelectedPermissions.includes('leads.view.all')
                || normalizedSelectedPermissions.includes('leads.view.own');

            if (!hasManageRoles || !hasViewLeads) {
                return res.redirect('/admin/roles?error=Your%20current%20role%20must%20keep%20manageRoles%20and%20viewLeads%20permissions');
            }
        }

        // System admin role must always keep baseline admin permissions.
        if (role.system && role.name === 'admin') {
            const requiredAdminPermissions = (ROLE_PERMISSIONS.admin || [])
                .map((permission) => String(permission).toLowerCase());

            const missingRequired = requiredAdminPermissions.filter(
                (permission) => !normalizedSelectedPermissions.includes(permission)
            );

            if (missingRequired.length > 0) {
                return res.redirect('/admin/roles?error=System%20admin%20role%20cannot%20remove%20critical%20permissions');
            }
        }

        // Ensure at least one role keeps both manageRoles and viewLeads permissions.
        const selectedHasManageRoles = normalizedSelectedPermissions.includes('roles.manage');
        const selectedHasViewLeads = normalizedSelectedPermissions.includes('leads.view.all')
            || normalizedSelectedPermissions.includes('leads.view.own');

        if (!selectedHasManageRoles || !selectedHasViewLeads) {
            const otherRoles = await Role.find({ _id: { $ne: role._id } })
                .select('permissions')
                .lean();

            const otherRoleWithManageAndView = otherRoles.some((candidate) => {
                const normalizedPermissions = (candidate.permissions || [])
                    .map((permission) => String(permission || '').trim().toLowerCase());
                return normalizedPermissions.includes('roles.manage')
                    && (normalizedPermissions.includes('leads.view.all') || normalizedPermissions.includes('leads.view.own'));
            });

            if (!otherRoleWithManageAndView) {
                return res.redirect('/admin/roles?error=At%20least%20one%20role%20must%20have%20both%20manageRoles%20and%20viewLeads%20permissions');
            }
        }

        const allowed = await Permission.find({ key: { $in: selectedPermissions } }).select('key').lean();
        role.permissions = allowed.map((item) => item.key);
        await role.save();

        await refreshPermissionsCache();

        await logAuditEvent(req, {
            action: 'roles.update_permissions',
            success: true,
            targetType: 'role',
            targetId: String(role._id),
            metadata: {
                roleName: role.name,
                permissionsCount: role.permissions.length
            }
        });

        res.redirect('/admin/roles?success=Permissions%20updated');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'roles.update_permissions',
            success: false,
            targetType: 'role',
            targetId: String(req.params.id || ''),
            metadata: {
                error: err.message
            }
        });

        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/permissions/create', requireCapability('roles.manage'), async (req, res) => {
    try {
        const key = (req.body.key || '').trim().toLowerCase();
        const description = (req.body.description || '').trim();

        if (!key || !/^[a-z0-9:_-]+$/.test(key)) {
            return res.redirect('/admin/roles?error=Permission%20key%20format%20is%20invalid');
        }

        if (isLegacyPermissionKey(key)) {
            return res.redirect('/admin/roles?error=Legacy%20permission%20keys%20are%20blocked.%20Use%20taxonomy%20format.');
        }

        const exists = await Permission.findOne({ key });
        if (exists) {
            return res.redirect('/admin/roles?error=Permission%20already%20exists');
        }

        await Permission.create({ key, description });

        await logAuditEvent(req, {
            action: 'permissions.create',
            success: true,
            targetType: 'permission',
            targetId: key,
            metadata: {
                description
            }
        });

        res.redirect('/admin/roles?success=Permission%20created');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'permissions.create',
            success: false,
            targetType: 'permission',
            targetId: String(req.body.key || '').trim().toLowerCase(),
            metadata: {
                error: err.message
            }
        });

        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/permissions/:id/update', requireCapability('roles.manage'), async (req, res) => {
    try {
        const permission = await Permission.findById(req.params.id);
        if (!permission) {
            return res.redirect('/admin/roles?error=Permission%20not%20found');
        }

        if (permission.system) {
            return res.redirect('/admin/roles?error=System%20permission%20cannot%20be%20updated');
        }

        const newKey = (req.body.key || '').trim().toLowerCase();
        const newDescription = (req.body.description || '').trim();
        if (!newKey || !/^[a-z0-9:_-]+$/.test(newKey)) {
            return res.redirect('/admin/roles?error=Permission%20key%20format%20is%20invalid');
        }

        if (isLegacyPermissionKey(newKey)) {
            return res.redirect('/admin/roles?error=Legacy%20permission%20keys%20are%20blocked.%20Use%20taxonomy%20format.');
        }

        const duplicate = await Permission.findOne({ _id: { $ne: permission._id }, key: newKey });
        if (duplicate) {
            return res.redirect('/admin/roles?error=Permission%20key%20already%20used');
        }

        const oldKey = permission.key;
        permission.key = newKey;
        permission.description = newDescription;
        await permission.save();

        await Role.updateMany(
            { permissions: oldKey },
            { $set: { 'permissions.$[p]': newKey } },
            { arrayFilters: [{ p: oldKey }] }
        );

        await refreshPermissionsCache();

        await logAuditEvent(req, {
            action: 'permissions.update',
            success: true,
            targetType: 'permission',
            targetId: String(permission._id),
            metadata: {
                oldKey,
                newKey
            }
        });

        res.redirect('/admin/roles?success=Permission%20updated');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'permissions.update',
            success: false,
            targetType: 'permission',
            targetId: String(req.params.id || ''),
            metadata: {
                error: err.message
            }
        });

        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/permissions/:id/delete', requireCapability('roles.manage'), async (req, res) => {
    try {
        const permission = await Permission.findById(req.params.id);
        if (!permission) {
            return res.redirect('/admin/roles?error=Permission%20not%20found');
        }

        if (permission.system) {
            return res.redirect('/admin/roles?error=System%20permission%20cannot%20be%20deleted');
        }

        await Permission.findByIdAndDelete(permission._id);
        await Role.updateMany(
            { permissions: permission.key },
            { $pull: { permissions: permission.key } }
        );

        await refreshPermissionsCache();

        await logAuditEvent(req, {
            action: 'permissions.delete',
            success: true,
            targetType: 'permission',
            targetId: String(permission._id),
            metadata: {
                deletedKey: permission.key
            }
        });

        res.redirect('/admin/roles?success=Permission%20deleted');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'permissions.delete',
            success: false,
            targetType: 'permission',
            targetId: String(req.params.id || ''),
            metadata: {
                error: err.message
            }
        });

        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

// Routes Mounting
app.use('/', crmRoutes);

// Error Handling
app.use((req, res, next) => {
    res.status(404).send('404 - Page Not Found');
});

app.use((err, req, res, next) => {
    console.error(`❌ Server Error: ${err.stack}`);
    res.status(500).send('Something went wrong on the server!');
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`💻 CRM Server running on http://${HOST}:${PORT}`);
});

// Daily lead export (email)
const { scheduleDailyExport } = require('./jobs/dailyLeadExport');
scheduleDailyExport();

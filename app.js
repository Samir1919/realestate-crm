require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db');
const crmRoutes = require('./routes/crmRoutes');
const User = require('./models/User');
const Role = require('./models/Role');
const Permission = require('./models/Permission');
const {
    canAccess,
    ROLE_PERMISSIONS,
    PERMISSION_CATALOG,
    ensureDefaultAccessData,
    refreshPermissionsCache
} = require('./utils/permissions');

const app = express();

// Database Connection
connectDB();

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
app.use(session({
    secret: process.env.SESSION_SECRET || 'crm-secret',
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    const currentRole = req.session?.user?.role || 'viewer';
    res.locals.currentRole = currentRole;
    res.locals.permissions = Object.keys(PERMISSION_CATALOG).reduce((acc, permissionKey) => {
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

app.get('/register', requirePermission('manageUsers'), (req, res) => {
    res.render('auth/register', { error: null });
});

app.post('/register', requirePermission('manageUsers'), async (req, res) => {
    try {
        const existing = await User.findOne({ email: req.body.email });
        if (existing) {
            return res.status(400).render('auth/register', { error: 'User already exists' });
        }

        const user = await User.create({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: 'viewer'
        });

        res.redirect('/admin/users?created=1');
    } catch (err) {
        res.status(500).render('auth/register', { error: err.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user || req.body.password !== user.password) {
            return res.status(401).render('auth/login', { error: 'Invalid credentials' });
        }

        req.session.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.redirect('/');
    } catch (err) {
        res.status(500).render('auth/login', { error: err.message });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
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

function requirePermission(permissionKey) {
    return (req, res, next) => {
        if (!req.session.user || !canAccess(req.session.user.role, permissionKey)) {
            return res.status(403).send('Permission denied');
        }
        next();
    };
}

app.get('/admin/users', requirePermission('manageUsers'), async (req, res) => {
    try {
        const roles = await Role.find().select('name').sort({ name: 1 }).lean();
        const users = await User.find().sort({ createdAt: -1 });
        res.render('admin/users', {
            users,
            roles,
            created: req.query.created === '1',
            error: req.query.error || null
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/admin/users/create', requirePermission('manageUsers'), async (req, res) => {
    try {
        await ensureDefaultAccessData();
        await refreshPermissionsCache();

        const existing = await User.findOne({ email: req.body.email });
        if (existing) {
            return res.redirect('/admin/users?error=User%20already%20exists');
        }

        await User.create({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: 'viewer'
        });

        res.redirect('/admin/users?created=1');
    } catch (err) {
        res.redirect(`/admin/users?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/users/:id/role', requirePermission('manageUsers'), async (req, res) => {
    try {
        const roleName = (req.body.role || '').toLowerCase();
        const roleExists = await Role.findOne({ name: roleName });
        if (!roleExists) {
            return res.status(400).send('Invalid role');
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { role: roleName },
            { returnDocument: 'after' }
        );

        if (!updatedUser) {
            return res.status(404).send('User not found');
        }

        if (req.session.user.id.toString() === updatedUser._id.toString()) {
            req.session.user.role = updatedUser.role;
        }

        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/admin/roles', requirePermission('manageRoles'), async (req, res) => {
    try {
        await ensureDefaultAccessData();
        await refreshPermissionsCache();

        const [roles, permissionCatalog] = await Promise.all([
            Role.find().sort({ name: 1 }).lean(),
            Permission.find().sort({ key: 1 }).lean()
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

app.post('/admin/roles/create', requirePermission('manageRoles'), async (req, res) => {
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
        res.redirect('/admin/roles?success=Role%20created');
    } catch (err) {
        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/roles/:id/update', requirePermission('manageRoles'), async (req, res) => {
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
        res.redirect('/admin/roles?success=Role%20updated');
    } catch (err) {
        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/roles/:id/delete', requirePermission('manageRoles'), async (req, res) => {
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

        res.redirect('/admin/roles?success=Role%20deleted');
    } catch (err) {
        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/roles/:id/permissions', requirePermission('manageRoles'), async (req, res) => {
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
            const hasManageRoles = normalizedSelectedPermissions.includes('manageroles');
            const hasViewLeads = normalizedSelectedPermissions.includes('viewleads');

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
        const selectedHasManageRoles = normalizedSelectedPermissions.includes('manageroles');
        const selectedHasViewLeads = normalizedSelectedPermissions.includes('viewleads');

        if (!selectedHasManageRoles || !selectedHasViewLeads) {
            const otherRoles = await Role.find({ _id: { $ne: role._id } })
                .select('permissions')
                .lean();

            const otherRoleWithManageAndView = otherRoles.some((candidate) => {
                const normalizedPermissions = (candidate.permissions || [])
                    .map((permission) => String(permission || '').trim().toLowerCase());
                return normalizedPermissions.includes('manageroles') && normalizedPermissions.includes('viewleads');
            });

            if (!otherRoleWithManageAndView) {
                return res.redirect('/admin/roles?error=At%20least%20one%20role%20must%20have%20both%20manageRoles%20and%20viewLeads%20permissions');
            }
        }

        const allowed = await Permission.find({ key: { $in: selectedPermissions } }).select('key').lean();
        role.permissions = allowed.map((item) => item.key);
        await role.save();

        await refreshPermissionsCache();
        res.redirect('/admin/roles?success=Permissions%20updated');
    } catch (err) {
        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/permissions/create', requirePermission('manageRoles'), async (req, res) => {
    try {
        const key = (req.body.key || '').trim().toLowerCase();
        const description = (req.body.description || '').trim();

        if (!key || !/^[a-z0-9:_-]+$/.test(key)) {
            return res.redirect('/admin/roles?error=Permission%20key%20format%20is%20invalid');
        }

        const exists = await Permission.findOne({ key });
        if (exists) {
            return res.redirect('/admin/roles?error=Permission%20already%20exists');
        }

        await Permission.create({ key, description });
        res.redirect('/admin/roles?success=Permission%20created');
    } catch (err) {
        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/permissions/:id/update', requirePermission('manageRoles'), async (req, res) => {
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
        res.redirect('/admin/roles?success=Permission%20updated');
    } catch (err) {
        res.redirect(`/admin/roles?error=${encodeURIComponent(err.message)}`);
    }
});

app.post('/admin/permissions/:id/delete', requirePermission('manageRoles'), async (req, res) => {
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
        res.redirect('/admin/roles?success=Permission%20deleted');
    } catch (err) {
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
app.listen(PORT, () => {
    console.log(`💻 CRM Server running on http://127.0.0.1:${PORT}`);
});
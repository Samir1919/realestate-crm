const User = require('../../models/User');
const Role = require('../../models/Role');
const {
    ensureDefaultAccessData,
    refreshPermissionsCache
} = require('../../utils/permissions');
const { logAuditEvent } = require('../../utils/auditLogger');
const { getDeletionDenial, getRoleChangeDenial } = require('../../utils/adminAccountPolicy');
const { validateNewPassword } = require('../../utils/passwordPolicy');

const GENERIC_USER_ERROR = 'Unable to complete the request. Please try again.';

function getActorSummary(req) {
    return {
        actorId: String(req.session?.user?.id || ''),
        actorEmail: String(req.session?.user?.email || ''),
        actorRole: String(req.session?.user?.role || '')
    };
}

async function renderRegisterPage(req, res) {
    res.render('auth/register', { error: null });
}

async function registerUser(req, res) {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!name || !email || !password) {
            return res.status(400).render('auth/register', { error: 'Name, email, and password are required' });
        }

        const passwordValidation = validateNewPassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).render('auth/register', { error: passwordValidation.message });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).render('auth/register', { error: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role: 'viewer'
        });

        await logAuditEvent(req, {
            action: 'users.register',
            success: true,
            targetType: 'user',
            targetId: String(user._id),
            metadata: {
                createdEmail: user.email,
                createdRole: user.role,
                ...getActorSummary(req)
            }
        });

        return res.redirect('/admin/users?created=1');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'users.register',
            success: false,
            targetType: 'user',
            metadata: {
                error: err.message,
                attemptedEmail: String(req.body.email || '').trim().toLowerCase(),
                ...getActorSummary(req)
            }
        });

        return res.status(500).render('auth/register', { error: GENERIC_USER_ERROR });
    }
}

async function renderUsersPage(req, res) {
    try {
        const roles = await Role.find().select('name').sort({ name: 1 }).lean();
        const users = await User.find().sort({ createdAt: -1 });

        return res.render('admin/users', {
            users,
            roles,
            created: req.query.created === '1',
            updated: req.query.updated === '1',
            deleted: req.query.deleted === '1',
            error: req.query.error || null
        });
    } catch (err) {
        return res.status(500).send(GENERIC_USER_ERROR);
    }
}

async function createUser(req, res) {
    try {
        await ensureDefaultAccessData();
        await refreshPermissionsCache();

        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!name || !email || !password) {
            return res.redirect('/admin/users?error=Name%2C%20email%2C%20and%20password%20are%20required');
        }

        const passwordValidation = validateNewPassword(password);
        if (!passwordValidation.valid) {
            return res.redirect(`/admin/users?error=${encodeURIComponent(passwordValidation.message)}`);
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.redirect('/admin/users?error=User%20already%20exists');
        }

        const user = await User.create({
            name,
            email,
            password,
            role: 'viewer'
        });

        await logAuditEvent(req, {
            action: 'users.create',
            success: true,
            targetType: 'user',
            targetId: String(user._id),
            metadata: {
                createdEmail: user.email,
                createdRole: user.role,
                ...getActorSummary(req)
            }
        });

        return res.redirect('/admin/users?created=1');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'users.create',
            success: false,
            targetType: 'user',
            metadata: {
                error: err.message,
                attemptedEmail: String(req.body.email || '').trim().toLowerCase(),
                ...getActorSummary(req)
            }
        });

        return res.redirect(`/admin/users?error=${encodeURIComponent(GENERIC_USER_ERROR)}`);
    }
}

async function assignUserRole(req, res) {
    try {
        const roleName = String(req.body.role || '').trim().toLowerCase();
        const roleExists = await Role.findOne({ name: roleName });
        if (!roleExists) {
            return res.status(400).send('Invalid role');
        }

        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).send('User not found');
        }

        const adminCount = targetUser.role === 'admin' && roleName !== 'admin'
            ? await User.countDocuments({ role: 'admin' })
            : 0;
        const denialReason = getRoleChangeDenial({
            actorId: req.session?.user?.id,
            targetId: targetUser._id,
            currentRole: targetUser.role,
            nextRole: roleName,
            adminCount
        });

        if (denialReason) {
            await logAuditEvent(req, {
                action: 'users.assign_role',
                success: false,
                targetType: 'user',
                targetId: String(targetUser._id),
                metadata: {
                    attemptedRole: roleName,
                    targetEmail: targetUser.email,
                    reason: denialReason,
                    ...getActorSummary(req)
                }
            });
            const message = denialReason === 'self_demotion'
                ? 'You cannot demote your own admin account.'
                : 'At least one admin must remain.';
            return res.redirect(`/admin/users?error=${encodeURIComponent(message)}`);
        }

        targetUser.role = roleName;
        await targetUser.save();
        const updatedUser = targetUser;

        if (req.session?.user?.id?.toString() === updatedUser._id.toString()) {
            req.session.user.role = updatedUser.role;
        }

        await logAuditEvent(req, {
            action: 'users.assign_role',
            success: true,
            targetType: 'user',
            targetId: String(updatedUser._id),
            metadata: {
                assignedRole: roleName,
                targetEmail: updatedUser.email,
                ...getActorSummary(req)
            }
        });

        return res.redirect('/admin/users?updated=1');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'users.assign_role',
            success: false,
            targetType: 'user',
            targetId: String(req.params.id || ''),
            metadata: {
                error: err.message,
                attemptedRole: String(req.body.role || '').trim().toLowerCase(),
                ...getActorSummary(req)
            }
        });

        return res.status(500).send(GENERIC_USER_ERROR);
    }
}

async function editUser(req, res) {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!name || !email) {
            return res.redirect('/admin/users?error=Name%20and%20email%20are%20required');
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.redirect('/admin/users?error=User%20not%20found');
        }

        const duplicate = await User.findOne({
            _id: { $ne: user._id },
            email
        });

        if (duplicate) {
            return res.redirect('/admin/users?error=Email%20already%20in%20use');
        }

        user.name = name;
        user.email = email;
        await user.save();

        if (req.session?.user && req.session.user.id.toString() === user._id.toString()) {
            req.session.user.name = user.name;
            req.session.user.email = user.email;
        }

        await logAuditEvent(req, {
            action: 'users.edit',
            success: true,
            targetType: 'user',
            targetId: String(user._id),
            metadata: {
                updatedEmail: user.email,
                updatedName: user.name,
                ...getActorSummary(req)
            }
        });

        return res.redirect('/admin/users?updated=1');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'users.edit',
            success: false,
            targetType: 'user',
            targetId: String(req.params.id || ''),
            metadata: {
                error: err.message,
                ...getActorSummary(req)
            }
        });

        return res.redirect(`/admin/users?error=${encodeURIComponent(GENERIC_USER_ERROR)}`);
    }
}

async function deleteUser(req, res) {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.redirect('/admin/users?error=User%20not%20found');
        }

        const adminCount = user.role === 'admin'
            ? await User.countDocuments({ role: 'admin' })
            : 0;
        const denialReason = getDeletionDenial({
            actorId: req.session?.user?.id,
            targetId: user._id,
            targetRole: user.role,
            adminCount
        });

        if (denialReason) {
            await logAuditEvent(req, {
                action: 'users.delete',
                success: false,
                targetType: 'user',
                targetId: String(user._id),
                metadata: {
                    targetEmail: user.email,
                    targetRole: user.role,
                    reason: denialReason,
                    ...getActorSummary(req)
                }
            });
            const message = denialReason === 'self_deletion'
                ? 'You cannot delete your own account.'
                : 'At least one admin must remain.';
            return res.redirect(`/admin/users?error=${encodeURIComponent(message)}`);
        }

        await User.findByIdAndDelete(user._id);

        await logAuditEvent(req, {
            action: 'users.delete',
            success: true,
            targetType: 'user',
            targetId: String(user._id),
            metadata: {
                deletedEmail: user.email,
                deletedRole: user.role,
                ...getActorSummary(req)
            }
        });

        return res.redirect('/admin/users?deleted=1');
    } catch (err) {
        await logAuditEvent(req, {
            action: 'users.delete',
            success: false,
            targetType: 'user',
            targetId: String(req.params.id || ''),
            metadata: {
                error: err.message,
                ...getActorSummary(req)
            }
        });

        return res.redirect(`/admin/users?error=${encodeURIComponent(GENERIC_USER_ERROR)}`);
    }
}

module.exports = {
    renderRegisterPage,
    registerUser,
    renderUsersPage,
    createUser,
    assignUserRole,
    editUser,
    deleteUser
};

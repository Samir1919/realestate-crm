const express = require('express');
const userHandlers = require('../controllers/user/handlers');
const { requireCapability } = require('../middleware/capabilityPolicy');

const router = express.Router();

router.get('/register', requireCapability('users.manage'), userHandlers.renderRegisterPage);
router.post('/register', requireCapability('users.manage'), userHandlers.registerUser);

router.get('/admin/users', requireCapability('users.manage'), userHandlers.renderUsersPage);
router.post('/admin/users/create', requireCapability('users.manage'), userHandlers.createUser);
router.post('/admin/users/:id/role', requireCapability('users.assignrole'), userHandlers.assignUserRole);
router.post('/admin/users/:id/edit', requireCapability('users.manage'), userHandlers.editUser);
router.post('/admin/users/:id/delete', requireCapability('users.manage'), userHandlers.deleteUser);

module.exports = router;

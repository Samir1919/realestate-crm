const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { requireCapability } = require('../middleware/capabilityPolicy');
const { csrfProtection } = require('../middleware/csrfProtection');
const { canAccess, ROLE_PERMISSIONS } = require('../utils/permissions');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use((req, res, next) => {
        req.session = req.session || {};
        const sessionToken = String(req.headers['x-session-csrf'] || '').trim();
        if (sessionToken) {
            req.session.csrfToken = sessionToken;
        }

        req.session.user = {
            role: String(req.headers['x-role'] || 'viewer')
        };
        next();
    });

    app.use(csrfProtection);

    app.post('/secure/profile', (req, res) => {
        res.status(200).json({ success: true });
    });

    app.post('/secure/users/manage', requireCapability('users.manage'), (req, res) => {
        res.status(200).json({ success: true, capability: 'users.manage' });
    });

    app.post('/secure/users/assign-role', requireCapability('users.assignrole'), (req, res) => {
        res.status(200).json({ success: true, capability: 'users.assignrole' });
    });

    app.post('/secure/reports/activity', requireCapability('reports.activity.view'), (req, res) => {
        res.status(200).json({ success: true, capability: 'reports.activity.view' });
    });

    return app;
}

async function withServer(run) {
    const app = createTestApp();
    const server = app.listen(0);
    await once(server, 'listening');

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
        await run(baseUrl);
    } finally {
        server.close();
        await once(server, 'close');
    }
}

test('csrfProtection blocks post without csrf token', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/secure/profile`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({ ok: true })
        });

        assert.equal(response.status, 403);
    });
});

test('csrfProtection allows post when header token matches session token', async () => {
    await withServer(async (baseUrl) => {
        const token = 'test-csrf-token';

        const response = await fetch(`${baseUrl}/secure/profile`, {
            method: 'POST',
            headers: {
                'x-csrf-token': token,
                'x-session-csrf': token,
                'x-role': 'viewer',
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: `_csrf=${encodeURIComponent(token)}`
        });

        assert.equal(response.status, 200);
    });
});

test('users.manage and users.assignrole stay split by capability', async () => {
    await withServer(async (baseUrl) => {
        const token = 'split-check-token';

        async function post(path, role) {
            return fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'x-role': role,
                    'x-csrf-token': token,
                    'x-session-csrf': token,
                    'content-type': 'application/x-www-form-urlencoded'
                },
                body: `_csrf=${encodeURIComponent(token)}`
            });
        }

        const adminManage = await post('/secure/users/manage', 'admin');
        assert.equal(adminManage.status, 200);

        const salesManage = await post('/secure/users/manage', 'sales');
        assert.equal(salesManage.status, 403);

        const adminAssign = await post('/secure/users/assign-role', 'admin');
        assert.equal(adminAssign.status, 200);

        const viewerAssign = await post('/secure/users/assign-role', 'viewer');
        assert.equal(viewerAssign.status, 403);
    });
});

test('users.manage capability does not imply users.assignrole', () => {
    ROLE_PERMISSIONS.manager = ['users.manage'];

    assert.equal(canAccess('manager', 'users.manage'), true);
    assert.equal(canAccess('manager', 'users.assignrole'), false);

    delete ROLE_PERMISSIONS.manager;
});

test('activity report capability is separate from user management', async () => {
    await withServer(async (baseUrl) => {
        const token = 'activity-report-token';

        async function post(path, role) {
            return fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    'x-role': role,
                    'x-csrf-token': token,
                    'x-session-csrf': token,
                    'content-type': 'application/x-www-form-urlencoded'
                },
                body: `_csrf=${encodeURIComponent(token)}`
            });
        }

        const adminReport = await post('/secure/reports/activity', 'admin');
        assert.equal(adminReport.status, 200);

        ROLE_PERMISSIONS.user_manager_only = ['users.manage'];
        const userManagerOnlyReport = await post('/secure/reports/activity', 'user_manager_only');
        assert.equal(userManagerOnlyReport.status, 403);

        delete ROLE_PERMISSIONS.user_manager_only;
    });
});

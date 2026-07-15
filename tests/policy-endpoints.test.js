const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const mongoose = require('mongoose');
const { requireLeadPolicy, requirePermissionPolicy } = require('../middleware/policy');

function createTestApp() {
    const app = express();
    app.use(express.json());

    app.use((req, res, next) => {
        req.session = {
            user: {
                role: String(req.headers['x-role'] || 'viewer'),
                id: String(req.headers['x-user-id'] || '')
            }
        };
        next();
    });

    app.get('/protected/leads', requireLeadPolicy('view'), (req, res) => {
        const policy = req.leadPolicy.view;
        res.status(200).json({
            ownership: policy.ownership,
            hasAssignedUserScope: Boolean(policy.scope && policy.scope.assignedUser)
        });
    });

    app.post('/protected/leads/:id/archive', requireLeadPolicy('delete'), (req, res) => {
        const policy = req.leadPolicy.delete;
        res.status(200).json({
            ownership: policy.ownership
        });
    });

    app.post('/protected/users/:id/role', requirePermissionPolicy('users.assignRole'), (req, res) => {
        res.status(200).json({
            success: true
        });
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

test('viewer can access lead list with all-scope policy', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/protected/leads`, {
            headers: {
                'x-role': 'viewer'
            }
        });

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.ownership, 'all');
        assert.equal(payload.hasAssignedUserScope, false);
    });
});

test('sales gets own-scope policy when a valid user id exists', async () => {
    await withServer(async (baseUrl) => {
        const userId = new mongoose.Types.ObjectId().toString();
        const response = await fetch(`${baseUrl}/protected/leads`, {
            headers: {
                'x-role': 'sales',
                'x-user-id': userId
            }
        });

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.ownership, 'own');
        assert.equal(payload.hasAssignedUserScope, true);
    });
});

test('sales is denied when own-scope policy has no valid user id', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/protected/leads`, {
            headers: {
                'x-role': 'sales',
                'x-user-id': 'invalid-id'
            }
        });

        assert.equal(response.status, 403);
    });
});

test('viewer cannot access delete endpoint', async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/protected/leads/1/archive`, {
            method: 'POST',
            headers: {
                'x-role': 'viewer'
            }
        });

        assert.equal(response.status, 403);
    });
});

test('assign-role endpoint requires users.assignRole capability', async () => {
    await withServer(async (baseUrl) => {
        const adminResponse = await fetch(`${baseUrl}/protected/users/1/role`, {
            method: 'POST',
            headers: {
                'x-role': 'admin'
            }
        });
        assert.equal(adminResponse.status, 200);

        const salesResponse = await fetch(`${baseUrl}/protected/users/1/role`, {
            method: 'POST',
            headers: {
                'x-role': 'sales'
            }
        });
        assert.equal(salesResponse.status, 403);
    });
});
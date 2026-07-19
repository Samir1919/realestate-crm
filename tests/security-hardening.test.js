const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const {
    accountAndIpKey,
    createLoginRateLimiters,
    createSecurityHeaders
} = require('../config/security');

const noOpAuditLogger = async () => {};

function createTestLoginRateLimiters() {
    return createLoginRateLimiters({ auditLogger: noOpAuditLogger });
}

async function withServer(configure, run) {
    const app = express();
    configure(app);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));

    try {
        const { port } = server.address();
        await run(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

test('security headers protect HTTP canary without HSTS or enforced CSP', async () => {
    await withServer((app) => {
        app.use(createSecurityHeaders({ hstsEnabled: false }));
        app.get('/', (req, res) => res.send('ok'));
    }, async (baseUrl) => {
        const response = await fetch(baseUrl);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(response.headers.get('x-frame-options'), 'DENY');
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(response.headers.get('strict-transport-security'), null);
        assert.equal(response.headers.get('content-security-policy'), null);
        assert.equal(response.headers.get('x-powered-by'), null);
    });
});

test('HSTS is available only through an explicit HTTPS-stage switch', async () => {
    await withServer((app) => {
        app.use(createSecurityHeaders({ hstsEnabled: true }));
        app.get('/', (req, res) => res.send('ok'));
    }, async (baseUrl) => {
        const response = await fetch(baseUrl);
        assert.equal(
            response.headers.get('strict-transport-security'),
            'max-age=15552000'
        );
    });
});

test('account limiter keys hash normalized emails and include normalized IP', () => {
    const first = accountAndIpKey({ ip: '192.0.2.10', body: { email: ' Admin@Example.COM ' } });
    const second = accountAndIpKey({ ip: '192.0.2.10', body: { email: 'admin@example.com' } });

    assert.equal(first, second);
    assert.match(first, /^192\.0\.2\.10:[a-f0-9]{64}$/);
    assert.doesNotMatch(first, /admin@example\.com/i);
});

test('sixth failed login for one account and IP is rate limited', async () => {
    const auditEvents = [];
    await withServer((app) => {
        app.set('view engine', 'ejs');
        app.set('views', `${__dirname}/../views`);
        app.use(express.urlencoded({ extended: true }));
        app.use((req, res, next) => {
            res.locals.csrfToken = 'test-csrf-token';
            next();
        });
        app.post('/login', ...createLoginRateLimiters({
            auditLogger: async (req, event) => auditEvents.push(event)
        }), (req, res) => {
            res.status(401).render('auth/login', { error: 'Invalid credentials' });
        });
    }, async (baseUrl) => {
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            const response = await fetch(`${baseUrl}/login`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: 'email=target%40example.com&password=wrong'
            });
            assert.equal(response.status, 401);
            await response.text();
        }

        const blocked = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'email=target%40example.com&password=wrong'
        });
        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.headers.get('retry-after')) > 0);
        assert.match(await blocked.text(), /Too many login attempts/);
        assert.equal(auditEvents.length, 1);
        assert.equal(auditEvents[0].action, 'auth.rate_limited');
        assert.equal(auditEvents[0].success, false);
    });
});

test('twenty-sixth failed login from one IP is rate limited across accounts', async () => {
    await withServer((app) => {
        app.set('view engine', 'ejs');
        app.set('views', `${__dirname}/../views`);
        app.use(express.urlencoded({ extended: true }));
        app.use((req, res, next) => {
            res.locals.csrfToken = 'test-csrf-token';
            next();
        });
        app.post('/login', ...createTestLoginRateLimiters(), (req, res) => {
            res.status(401).send('invalid');
        });
    }, async (baseUrl) => {
        for (let attempt = 1; attempt <= 25; attempt += 1) {
            const response = await fetch(`${baseUrl}/login`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: `email=user${attempt}%40example.com&password=wrong`
            });
            assert.equal(response.status, 401);
            await response.text();
        }

        const blocked = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'email=another%40example.com&password=wrong'
        });
        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.headers.get('retry-after')) > 0);
        assert.match(await blocked.text(), /Too many login attempts/);
    });
});

test('successful logins do not consume the failure quota', async () => {
    await withServer((app) => {
        app.use(express.urlencoded({ extended: true }));
        app.post('/login', ...createTestLoginRateLimiters(), (req, res) => {
            if (req.body.password === 'correct') {
                return res.redirect(303, '/ok');
            }
            return res.status(401).send('invalid');
        });
        app.get('/ok', (req, res) => res.send('ok'));
    }, async (baseUrl) => {
        for (let attempt = 0; attempt < 6; attempt += 1) {
            const response = await fetch(`${baseUrl}/login`, {
                method: 'POST',
                redirect: 'manual',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: 'email=success%40example.com&password=correct'
            });
            assert.equal(response.status, 303);
            await response.text();
        }

        const failed = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'email=success%40example.com&password=wrong'
        });
        assert.equal(failed.status, 401);
    });
});

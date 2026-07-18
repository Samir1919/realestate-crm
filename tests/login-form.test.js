const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const loginTemplate = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'auth', 'login.ejs'),
    'utf8'
);

test('login form keeps native POST and submit semantics', () => {
    assert.match(loginTemplate, /<form id="loginForm" method="POST" action="\/login"/);
    assert.match(loginTemplate, /name="email" type="email" autocomplete="username" required/);
    assert.match(loginTemplate, /name="password" type="password" autocomplete="current-password" required/);
    assert.match(loginTemplate, /<button type="submit"/);
});

test('login credential fields explicitly submit on Enter', () => {
    assert.match(loginTemplate, /addEventListener\('keydown'/);
    assert.match(loginTemplate, /event\.key !== 'Enter'/);
    assert.match(loginTemplate, /event\.isComposing/);
    assert.match(loginTemplate, /event\.preventDefault\(\)/);
    assert.match(loginTemplate, /loginForm\.requestSubmit\(loginSubmitButton\)/);
});

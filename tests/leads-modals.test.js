const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('leads modal partial includes edit, archive, request, restore, reject, and view modal containers', () => {
    const modalPath = path.join(__dirname, '..', 'views', 'leads', 'partials', 'modals.ejs');
    const source = fs.readFileSync(modalPath, 'utf8');

    assert.match(source, /id="editLeadModal"/);
    assert.match(source, /id="deleteLeadModal"/);
    assert.match(source, /id="requestLeadInactiveModal"/);
    assert.match(source, /id="restoreLeadModal"/);
    assert.match(source, /id="rejectLeadRequestModal"/);
    assert.match(source, /id="viewLeadModal"/);
});

test('leads modal partial includes request history view partial fields', () => {
    const modalPath = path.join(__dirname, '..', 'views', 'leads', 'partials', 'modals.ejs');
    const source = fs.readFileSync(modalPath, 'utf8');

    assert.match(source, /include\('view-request-history'\)/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('leads modal partial includes edit, delete, and view modal containers', () => {
    const modalPath = path.join(__dirname, '..', 'views', 'leads', 'partials', 'modals.ejs');
    const source = fs.readFileSync(modalPath, 'utf8');

    assert.match(source, /id="editLeadModal"/);
    assert.match(source, /id="deleteLeadModal"/);
    assert.match(source, /id="viewLeadModal"/);
});

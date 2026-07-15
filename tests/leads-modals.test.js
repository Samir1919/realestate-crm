const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readModalSources() {
    const partialsDir = path.join(__dirname, '..', 'views', 'leads', 'partials');
    const modalPath = path.join(partialsDir, 'modals.ejs');
    const bundledSources = [];
    const visited = new Set();

    function normalizeIncludeTarget(rawTarget) {
        return rawTarget.endsWith('.ejs') ? rawTarget : `${rawTarget}.ejs`;
    }

    function collectSource(filePath) {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath) || visited.has(resolvedPath)) {
            return;
        }

        visited.add(resolvedPath);
        const source = fs.readFileSync(resolvedPath, 'utf8');
        bundledSources.push(source);

        const includeMatches = source.matchAll(/include\('([^']+)'\)/g);
        for (const match of includeMatches) {
            const includeTarget = normalizeIncludeTarget(match[1]);
            const includePath = path.resolve(path.dirname(resolvedPath), includeTarget);
            collectSource(includePath);
        }
    }

    collectSource(modalPath);
    return bundledSources.join('\n');
}

test('leads modal partial includes edit, archive, request, restore, reject, and view modal containers', () => {
    const source = readModalSources();

    assert.match(source, /id="editLeadModal"/);
    assert.match(source, /id="deleteLeadModal"/);
    assert.match(source, /id="requestLeadInactiveModal"/);
    assert.match(source, /id="restoreLeadModal"/);
    assert.match(source, /id="rejectLeadRequestModal"/);
    assert.match(source, /id="viewLeadModal"/);
});

test('leads modal partial includes request history view partial fields', () => {
    const source = readModalSources();

    assert.match(source, /id="view_requestHistorySection"/);
});

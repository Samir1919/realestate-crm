const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildLeadChangedFields,
    buildLeadFieldChanges
} = require('../controllers/lead/mutationUtils');

test('lead updates record safe before and after values for activity reporting', () => {
    const existingLead = {
        status: 'New',
        priority: 'Warm',
        messageNote: 'Private previous note'
    };
    const updatePayload = {
        status: 'Interested',
        priority: 'Hot',
        messageNote: 'Private next note'
    };
    const changedFields = buildLeadChangedFields(existingLead, updatePayload);
    const changes = buildLeadFieldChanges(existingLead, updatePayload, changedFields);

    assert.deepEqual(changes.status, { from: 'New', to: 'Interested' });
    assert.deepEqual(changes.priority, { from: 'Warm', to: 'Hot' });
    assert.equal(changes.messageNote, undefined);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { __testables } = require('../controllers/leadController');

test('normalizeLeadCustomerName trims and collapses extra spaces', () => {
    assert.equal(
        __testables.normalizeLeadCustomerName('   Md.    Rakib   Hasan   '),
        'Md. Rakib Hasan'
    );
});

test('normalizeLeadCustomerName converts multiline and tab spacing to single spaces', () => {
    assert.equal(
        __testables.normalizeLeadCustomerName('\n\tSamira\t\tAkter\n\n'),
        'Samira Akter'
    );
});

test('normalizeLeadCustomerName returns undefined for blank-like values', () => {
    assert.equal(__testables.normalizeLeadCustomerName('   '), undefined);
    assert.equal(__testables.normalizeLeadCustomerName('null'), undefined);
    assert.equal(__testables.normalizeLeadCustomerName('undefined'), undefined);
});

test('normalizeLeadCustomerName removes ~ character from name', () => {
    assert.equal(
        __testables.normalizeLeadCustomerName('   Rahim   ~   Karim   '),
        'Rahim Karim'
    );
});

function formatLeadReference(number, prefix = 'LD', width = 6) {
    const padded = String(number).padStart(width, '0');
    return `${prefix}-${padded}`;
}

module.exports = {
    formatLeadReference
};

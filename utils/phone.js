const { parsePhoneNumberFromString } = require('libphonenumber-js');

const PHONE_VALIDATION_MESSAGE = 'সঠিক ফোন নম্বর দিন। দেশ কোডসহ valid number দিন, যেমন +880..., +1..., বা local BD mobile।';

function sanitizePhoneNumber(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const rawValue = String(value).trim();
    if (!rawValue) {
        return '';
    }

    const compactValue = rawValue.replace(/[\s().-]/g, '');
    const normalizedPlusPrefix = compactValue.startsWith('00') ? `+${compactValue.slice(2)}` : compactValue;

    if (normalizedPlusPrefix.startsWith('+')) {
        return `+${normalizedPlusPrefix.slice(1).replace(/\D/g, '')}`;
    }

    return normalizedPlusPrefix.replace(/\D/g, '');
}

function parsePhoneNumber(value, defaultCountry = 'BD') {
    const sanitizedPhone = sanitizePhoneNumber(value);

    if (!sanitizedPhone) {
        return null;
    }

    const primaryParse = sanitizedPhone.startsWith('+')
        ? parsePhoneNumberFromString(sanitizedPhone)
        : parsePhoneNumberFromString(sanitizedPhone, defaultCountry);

    if (primaryParse && primaryParse.isValid()) {
        return primaryParse;
    }

    if (!sanitizedPhone.startsWith('+') && !sanitizedPhone.startsWith('0')) {
        const internationalParse = parsePhoneNumberFromString(`+${sanitizedPhone}`);
        if (internationalParse && internationalParse.isValid()) {
            return internationalParse;
        }
    }

    return null;
}

function normalizePhoneNumber(value, defaultCountry = 'BD') {
    const phoneNumber = parsePhoneNumber(value, defaultCountry);
    return phoneNumber ? phoneNumber.number : '';
}

function isValidPhoneNumber(value) {
    return Boolean(parsePhoneNumber(value));
}

module.exports = {
    PHONE_VALIDATION_MESSAGE,
    normalizePhoneNumber,
    parsePhoneNumber,
    sanitizePhoneNumber,
    isValidPhoneNumber
};
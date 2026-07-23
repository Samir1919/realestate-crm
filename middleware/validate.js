const Joi = require('joi');

// Middleware to validate request bodies against a Joi schema
defineValidate = (schema) => async (req, res, next) => {
    try {
        const validated = await schema.validateAsync(req.body, { abortEarly: false, stripUnknown: true });
        req.body = validated;
        next();
    } catch (err) {
        // Forward validation errors
        err.isJoi = true;
        return next(err);
    }
};

module.exports = { validate: defineValidate };

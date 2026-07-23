const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { translateTime: true, colorize: true }
    } : undefined
});

module.exports = logger;

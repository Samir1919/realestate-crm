require('dotenv').config();

const mongoose = require('mongoose');

async function dropDatabase() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error('MONGO_URI is not set');
    }

    await mongoose.connect(mongoUri);
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();

    console.log('Database dropped successfully');
}

dropDatabase().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
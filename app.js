require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/db');
const crmRoutes = require('./routes/crmRoutes');

const app = express();

// Database Connection
connectDB();

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes Mounting
app.use('/', crmRoutes);

// Error Handling
app.use((req, res, next) => {
    res.status(404).send('404 - Page Not Found');
});

app.use((err, req, res, next) => {
    console.error(`❌ Server Error: ${err.stack}`);
    res.status(500).send('Something went wrong on the server!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`💻 CRM Server running on http://127.0.0.1:${PORT}`);
});
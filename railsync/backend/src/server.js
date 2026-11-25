require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

const frontend = path.resolve(__dirname, '../../../frontend');
app.use(express.static(frontend));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'RailSync API' }));

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => console.log(`RailSync server listening on port ${PORT}`));

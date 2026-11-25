// Admin-only endpoints (JWT + role ADMIN required for everything here)
const router = require('express').Router();
const { body, param } = require('express-validator');
const db = require('../config/db');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(auth, (req, res, next) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Administrator access required.' });
  next();
});

router.get('/stats', async (req, res) => {
  const queries = [
    ['users', 'SELECT COUNT(*) AS total FROM users'],
    ['trains', 'SELECT COUNT(*) AS total FROM trains'],
    ['stations', 'SELECT COUNT(*) AS total FROM stations'],
    ['bookings', 'SELECT COUNT(*) AS total FROM bookings'],
    ['revenue', "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_status = 'SUCCESS'"]
  ];
  const stats = {};
  for (const [key, sql] of queries) {
    const [[row]] = await db.query(sql);
    stats[key] = Number(row.total);
  }
  res.json(stats);
});

router.get('/users', async (req, res) => {
  const [rows] = await db.execute(
    'SELECT user_id, full_name, email, phone, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(rows);
});

router.patch('/users/:id/role', [
  param('id').isInt({ min: 1 }),
  body('role').isIn(['USER', 'ADMIN'])
], validate, async (req, res) => {
  const [result] = await db.execute('UPDATE users SET role = ? WHERE user_id = ?', [req.body.role, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
  res.json({ message: 'Role updated.' });
});

router.get('/trains', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT t.*, COUNT(DISTINCT r.route_id) AS stop_count
       FROM trains t LEFT JOIN train_routes r ON r.train_id = t.train_id
      GROUP BY t.train_id ORDER BY t.train_number`
  );
  res.json(rows);
});

router.post('/trains', [
  body('train_number').trim().notEmpty(),
  body('train_name').trim().notEmpty(),
  body('train_type').trim().notEmpty(),
  body('source_station_id').isInt({ min: 1 }),
  body('destination_station_id').isInt({ min: 1 }),
  body('distance_km').isFloat({ min: 1 }),
  body('duration_min').isInt({ min: 1 })
], validate, async (req, res) => {
  const { train_number, train_name, train_type, source_station_id, destination_station_id, distance_km, duration_min } = req.body;
  const [result] = await db.execute(
    `INSERT INTO trains (train_number, train_name, train_type, source_station_id, destination_station_id, distance_km, duration_min)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [train_number, train_name, train_type, source_station_id, destination_station_id, distance_km, duration_min]
  );
  res.status(201).json({ train_id: result.insertId });
});

router.patch('/trains/:id', [
  param('id').isInt({ min: 1 }),
  body('train_name').optional().trim().notEmpty(),
  body('train_type').optional().trim().notEmpty(),
  body('distance_km').optional().isFloat({ min: 1 }),
  body('duration_min').optional().isInt({ min: 1 }),
  body('is_active').optional().isBoolean()
], validate, async (req, res) => {
  const allowed = ['train_name', 'train_type', 'distance_km', 'duration_min', 'is_active'];
  const updates = Object.entries(req.body).filter(([key]) => allowed.includes(key));
  if (!updates.length) return res.status(400).json({ message: 'No valid fields to update.' });
  const [result] = await db.execute(
    `UPDATE trains SET ${updates.map(([key]) => `${key} = ?`).join(', ')} WHERE train_id = ?`,
    [...updates.map(([, value]) => value), req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Train not found.' });
  res.json({ message: 'Train updated.' });
});

router.delete('/trains/:id', [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  const [result] = await db.execute('DELETE FROM trains WHERE train_id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Train not found.' });
  res.json({ message: 'Train deleted.' });
});

router.get('/stations', async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM stations ORDER BY station_name');
  res.json(rows);
});

router.post('/stations', [
  body('station_code').trim().notEmpty(),
  body('station_name').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('state').trim().notEmpty()
], validate, async (req, res) => {
  const { station_code, station_name, city, state } = req.body;
  const [result] = await db.execute(
    'INSERT INTO stations (station_code, station_name, city, state) VALUES (?, ?, ?, ?)',
    [station_code, station_name, city, state]
  );
  res.status(201).json({ station_id: result.insertId });
});

router.patch('/stations/:id', [
  param('id').isInt({ min: 1 }),
  body('station_name').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('state').optional().trim().notEmpty()
], validate, async (req, res) => {
  const allowed = ['station_name', 'city', 'state'];
  const updates = Object.entries(req.body).filter(([key]) => allowed.includes(key));
  if (!updates.length) return res.status(400).json({ message: 'No valid fields to update.' });
  const [result] = await db.execute(
    `UPDATE stations SET ${updates.map(([key]) => `${key} = ?`).join(', ')} WHERE station_id = ?`,
    [...updates.map(([, value]) => value), req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Station not found.' });
  res.json({ message: 'Station updated.' });
});

router.delete('/stations/:id', [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  const [result] = await db.execute('DELETE FROM stations WHERE station_id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Station not found.' });
  res.json({ message: 'Station deleted.' });
});

router.get('/schedules', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT ts.*, t.train_number, t.train_name
       FROM train_schedules ts JOIN trains t ON t.train_id = ts.train_id
      ORDER BY ts.journey_date DESC LIMIT 500`
  );
  res.json(rows);
});

router.post('/schedules', [
  body('train_id').isInt({ min: 1 }),
  body('journey_date').isISO8601(),
  body('status').optional().isIn(['SCHEDULED', 'CANCELLED'])
], validate, async (req, res) => {
  const { train_id, journey_date, status = 'SCHEDULED' } = req.body;
  const [result] = await db.execute(
    'INSERT INTO train_schedules (train_id, journey_date, status) VALUES (?, ?, ?)',
    [train_id, journey_date, status]
  );
  res.status(201).json({ schedule_id: result.insertId });
});

router.patch('/schedules/:id', [
  param('id').isInt({ min: 1 }),
  body('journey_date').optional().isISO8601(),
  body('status').optional().isIn(['SCHEDULED', 'CANCELLED'])
], validate, async (req, res) => {
  const allowed = ['journey_date', 'status'];
  const updates = Object.entries(req.body).filter(([key]) => allowed.includes(key));
  if (!updates.length) return res.status(400).json({ message: 'No valid fields to update.' });
  const [result] = await db.execute(
    `UPDATE train_schedules SET ${updates.map(([key]) => `${key} = ?`).join(', ')} WHERE schedule_id = ?`,
    [...updates.map(([, value]) => value), req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Schedule not found.' });
  res.json({ message: 'Schedule updated.' });
});

router.delete('/schedules/:id', [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  const [result] = await db.execute('DELETE FROM train_schedules WHERE schedule_id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: 'Schedule not found.' });
  res.json({ message: 'Schedule deleted.' });
});

router.get('/bookings', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT b.booking_id, b.pnr_number, b.booking_status, b.total_fare, b.booking_date,
            u.full_name AS booked_by, t.train_number, t.train_name, ts.journey_date
       FROM bookings b
       JOIN users u ON u.user_id = b.user_id
       JOIN train_schedules ts ON ts.schedule_id = b.schedule_id
       JOIN trains t ON t.train_id = ts.train_id
      ORDER BY b.booking_date DESC LIMIT 500`
  );
  res.json(rows);
});

module.exports = router;

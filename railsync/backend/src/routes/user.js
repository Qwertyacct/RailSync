// Logged-in user endpoints: passengers, bookings, cancellation
const router = require('express').Router();
const { body } = require('express-validator');
const db = require('../config/db');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(auth);

router.get('/passengers', async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM passengers WHERE user_id = ? ORDER BY passenger_id DESC', [req.user.user_id]);
  res.json(rows);
});

router.post('/passengers', [
  body('full_name').trim().isLength({ min: 2 }).withMessage('Name must have at least 2 characters.'),
  body('age').isInt({ min: 1, max: 120 }).withMessage('Age must be between 1 and 120.'),
  body('gender').isIn(['M', 'F', 'O']).withMessage('Invalid gender.')
], validate, async (req, res) => {
  const { full_name, age, gender } = req.body;
  const [result] = await db.execute(
    'INSERT INTO passengers (user_id, full_name, age, gender) VALUES (?, ?, ?, ?)',
    [req.user.user_id, full_name, age, gender]
  );
  res.status(201).json({ passenger_id: result.insertId });
});

router.delete('/passengers/:id', async (req, res) => {
  const [result] = await db.execute(
    'DELETE FROM passengers WHERE passenger_id = ? AND user_id = ?',
    [req.params.id, req.user.user_id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Passenger not found.' });
  res.json({ message: 'Passenger deleted.' });
});

router.get('/bookings', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT b.booking_id, b.pnr_number, b.booking_status, b.total_fare, b.booking_date,
            ts.journey_date, t.train_number, t.train_name,
            sf.station_name AS from_station, st.station_name AS to_station
       FROM bookings b
       JOIN train_schedules ts ON ts.schedule_id = b.schedule_id
       JOIN trains t ON t.train_id = ts.train_id
       JOIN stations sf ON sf.station_id = b.from_station_id
       JOIN stations st ON st.station_id = b.to_station_id
      WHERE b.user_id = ? ORDER BY b.booking_date DESC`,
    [req.user.user_id]
  );
  res.json(rows);
});

router.post('/bookings', [
  body('schedule_id').isInt({ min: 1 }),
  body('from_station_id').isInt({ min: 1 }),
  body('to_station_id').isInt({ min: 1 }),
  body('class_code').isIn(['1A', '2A', '3A', 'SL', 'CC', '2S']),
  body('passenger_ids').isArray({ min: 1, max: 6 }),
  body('passenger_ids.*').isInt({ min: 1 })
], validate, async (req, res) => {
  const { schedule_id, from_station_id, to_station_id, class_code, passenger_ids } = req.body;
  const [rows] = await db.execute(
    'CALL book_ticket(?, ?, ?, ?, ?, @booking_id, @pnr, @fare)',
    [req.user.user_id, schedule_id, from_station_id, to_station_id, JSON.stringify(passenger_ids.map(Number))]
  );
  const [[out]] = await db.query('SELECT @booking_id AS booking_id, @pnr AS pnr_number, @fare AS total_fare');
  res.status(201).json(out);
});

router.post('/bookings/:id/cancel', async (req, res) => {
  await db.execute('CALL cancel_ticket(?, ?)', [req.params.id, req.user.user_id]);
  res.json({ message: 'Booking cancelled.' });
});

module.exports = router;

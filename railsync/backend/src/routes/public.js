// Public (no login) endpoints: stations, train search, route, availability
const router = require('express').Router();
const { query } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');

router.get('/stations', async (req, res) => {
  const [rows] = await db.execute('SELECT station_id, station_code, station_name, city, state FROM stations ORDER BY station_name');
  res.json(rows);
});

router.get('/trains/search', [
  query('from').trim().notEmpty(),
  query('to').trim().notEmpty(),
  query('date').isISO8601().withMessage('A valid journey date is required.')
], validate, async (req, res) => {
  const { from, to, date } = req.query;
  const [rows] = await db.execute(
    'CALL search_trains(?, ?, ?)',
    [from.toUpperCase(), to.toUpperCase(), date]
  );
  res.json(rows[0]);
});

router.get('/trains/:id/route', async (req, res) => {
  const [rows] = await db.execute(
    `SELECT r.stop_number, s.station_code, s.station_name, r.arrival_time, r.departure_time,
            r.distance_from_origin_km
       FROM train_routes r JOIN stations s ON s.station_id = r.station_id
      WHERE r.train_id = ? ORDER BY r.stop_number`,
    [req.params.id]
  );
  res.json(rows);
});

router.get('/schedules/:id/availability', async (req, res) => {
  const [rows] = await db.execute('CALL check_availability(?)', [req.params.id]);
  res.json(rows[0]);
});

module.exports = router;

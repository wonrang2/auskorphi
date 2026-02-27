const express = require('express');
const fetch = require('node-fetch');
const db = require('../db');

const router = express.Router();
const CACHE_MINUTES = 60;

router.get('/', async (req, res, next) => {
  try {
    // Check cache first
    const cached = db.prepare(`
      SELECT rate, fetched_at FROM exchange_rate_cache
      ORDER BY id DESC LIMIT 1
    `).get();

    if (cached) {
      const fetchedAt = new Date(cached.fetched_at + 'Z');
      const ageMinutes = (Date.now() - fetchedAt.getTime()) / 60000;
      if (ageMinutes < CACHE_MINUTES) {
        return res.json({ rate: cached.rate, source: 'cache', fetchedAt: cached.fetched_at });
      }
    }

    // Fetch live rate
    const response = await fetch('https://api.frankfurter.app/latest?from=AUD&to=PHP');
    if (!response.ok) throw new Error('Frankfurter API error: ' + response.status);

    const data = await response.json();
    const rate = data.rates.PHP;

    // Store in cache
    db.prepare('INSERT INTO exchange_rate_cache (rate) VALUES (?)').run(rate);

    res.json({ rate, source: 'live', fetchedAt: new Date().toISOString() });
  } catch (err) {
    // Fallback to last known rate
    const fallback = db.prepare('SELECT rate, fetched_at FROM exchange_rate_cache ORDER BY id DESC LIMIT 1').get();
    if (fallback) {
      return res.json({ rate: fallback.rate, source: 'fallback', fetchedAt: fallback.fetched_at });
    }
    next(err);
  }
});

module.exports = router;

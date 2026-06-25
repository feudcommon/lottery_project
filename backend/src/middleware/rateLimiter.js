// src/middleware/rateLimiter.js
//
// RATE LIMITING EXPLAINED:
// express-rate-limit tracks requests per IP (by default) in a time window
// and blocks (HTTP 429) once a limit is hit. Different endpoints need
// different limits:
//   - Login: a few attempts per minute is plenty for a real user.
//   - Buy ticket: should already be capped by game logic (max 2/day), but
//     rate limiting stops someone from hammering the endpoint to try to
//     win a race condition or just DoS your server.
//   - Spin/earn: this is the MOST important one to limit tightly, since
//     it's the literal "free coins" faucet — if abusable, the whole
//     economy breaks.
//
// In production with multiple server instances behind a load balancer,
// swap the default in-memory store for a Redis store (rate-limit-redis)
// so all instances share the same counters. Noted below.

const rateLimit = require("express-rate-limit");

const standardHandler = (req, res) => {
  res.status(429).json({ error: "Too many requests, please slow down and try again shortly." });
};

// General API-wide safety net — generous, just stops outright abuse/bots
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests/minute/IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

// Login attempts — looser brute force protection
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

// Buying tickets — generous enough for a real user clicking around,
// tight enough to stop scripted spam
const buyTicketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

// Spin/earn — the critical one. One legit user has no reason to call this
// more than once or twice a minute even accounting for double-taps/retries.
const spinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

// Withdrawals — money-moving endpoint, keep it tight
const withdrawLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

module.exports = {
  globalLimiter,
  loginLimiter,
  buyTicketLimiter,
  spinLimiter,
  withdrawLimiter,
};

// ---------------------------------------------------------------------------
// SCALING NOTE: if you deploy more than one Node process/server, in-memory
// rate limiting won't be shared between them. Swap the store:
//
//   const RedisStore = require('rate-limit-redis');
//   const limiter = rateLimit({ store: new RedisStore({ client: redisClient }), ... });
// ---------------------------------------------------------------------------

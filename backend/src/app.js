// src/app.js
//
// This is where the Express app is assembled: middleware order matters
// here, so read top-to-bottom — that's the actual order requests flow
// through.

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

const { globalLimiter } = require("./middleware/rateLimiter");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const coinRoutes = require("./routes/coinRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const adminRoutes = require("./routes/adminRoutes");
const drawRoutes = require("./routes/drawRoutes");
const jackpotRoutes = require("./routes/jackpotRoutes");


function createApp() {
  const app = express();
app.set('trust proxy', 1); // ← ADD THIS

  // --- Security & parsing middleware (runs on EVERY request) ---
  app.use(helmet());                 // sets safe HTTP headers (XSS protection, etc.)
  app.use(cors());                   // allows your Telegram Mini App frontend to call this API
  app.use(express.json({ limit: "100kb" })); // parses JSON bodies; size cap stops huge payload abuse
  app.use(globalLimiter);            // general rate-limit safety net, applies to all routes below

  // --- Health check (useful for uptime monitoring / load balancers) ---
  app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  // --- Route mounting ---
  // Each group of routes is "mounted" at a base path. So
  // router.post('/telegram', ...) inside authRoutes becomes POST /api/auth/telegram.
  app.use("/api/auth", authRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/withdraw", withdrawalRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/draws", drawRoutes);
  app.use("/api", coinRoutes);    // POST /api/spin
  app.use("/api", ticketRoutes);  // POST /api/buy-ticket, GET /api/tickets/today
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/jackpot", jackpotRoutes);

  // --- 404 + error handlers (MUST be registered last) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

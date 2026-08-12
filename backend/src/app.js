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
const depositRoutes = require("./routes/depositRoutes");
const publicRoutes = require("./routes/publicRoutes");
const stripeRoutes = require("./routes/stripeRoutes");
const debugRoutes = require("./routes/debugRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  const corsOptions = {};
  if (process.env.FRONTEND_URL) {
    corsOptions.origin = process.env.FRONTEND_URL;
  }

  app.use(helmet());
  app.use(cors(corsOptions));

  // Stripe's webhook signature verification needs the raw, unparsed request
  // body. This MUST be registered before the global express.json() below —
  // otherwise json() consumes the body stream first, and by the time the
  // webhook route's own body parsing runs, there's nothing left to read.
  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

  app.use(express.json({ limit: "100kb" }));
  app.use(globalLimiter);

  app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/withdraw", withdrawalRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/draws", drawRoutes);
  app.use("/api", coinRoutes);
  app.use("/api", ticketRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/jackpot", jackpotRoutes);
  app.use("/api/deposit", depositRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/stripe", stripeRoutes);
  app.use("/api/debug", debugRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
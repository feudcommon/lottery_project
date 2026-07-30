require("dotenv").config();
const { createApp } = require("./app");
const { startLotteryCronJobs } = require("./jobs/lotteryCron");
const config = require("./config");

if (!config.jwt.secret) {
  console.error("FATAL: JWT_SECRET is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

if (!Number.isInteger(config.port) || config.port <= 0) {
  console.error(`FATAL: invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

try {
  require("./db/init");
} catch (error) {
  console.error("FATAL: Database initialization failed:", error);
  process.exit(1);
}

const app = createApp();

app.listen(config.port, "0.0.0.0", () => {
  console.log(` SCAI Lucky Loop backend running on port ${config.port} (${config.nodeEnv})`);
  startLotteryCronJobs();
});
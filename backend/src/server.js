require("dotenv").config();
const { createApp } = require("./app");
const { startLotteryCronJobs } = require("./jobs/lotteryCron");
const config = require("./config");

if (!config.jwt.secret) {
  console.error("FATAL: JWT_SECRET is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// ← ADD THIS LINE
require("./db/init");

const app = createApp();

app.listen(config.port, () => {
  console.log(` SCAI Lucky Loop backend running on port ${config.port} (${config.nodeEnv})`);
  startLotteryCronJobs();
});
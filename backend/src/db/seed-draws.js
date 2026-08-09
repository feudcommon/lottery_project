// backend/src/db/seed-draws.js
const db = require("./connection");

const testDraws = [
  { date: "2026-06-30", status: "drawn", winnerId: null },
  { date: "2026-07-01", status: "open", winnerId: null },
];

async function seed() {
  for (const draw of testDraws) {
    await db
      .prepare(
        `INSERT INTO draws (draw_date, status, winner_user_id)
         VALUES (?, ?, ?)
         ON CONFLICT(draw_date) DO NOTHING`,
      )
      .run(draw.date, draw.status, draw.winnerId);
  }
  console.log("Test draws created!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed draws:", err);
    process.exit(1);
  });
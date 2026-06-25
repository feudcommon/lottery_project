// src/jobs/lotteryCron.js
//
// NODE-CRON EXPLAINED:
// node-cron lets you schedule a function to run on a recurring schedule
// using standard "cron syntax": five fields = minute, hour, day-of-month,
// month, day-of-week. '0 15 * * *' means "at minute 0 of hour 15, every
// day, every month, every day-of-week" = every day at 15:00.
//
// This file owns the ENTIRE daily lottery lifecycle so it runs automatically
// without anyone manually triggering it:
//   09:00 -> (implicitly handled — ticketService.isSalesOpen() just starts
//             returning true once the clock passes this hour; we still log
//             it for visibility / could send a Telegram broadcast here)
//   15:00 -> close sales + commit the random seed (hash published)
//   18:00 -> run the draw using the committed seed, reveal it, pay the winner
//   00:01 -> create tomorrow's draw row ahead of time (housekeeping)
//
// IMPORTANT: cron times run in the SERVER'S timezone by default. Pass a
// `timezone` option if your server isn't already in the timezone your
// users expect (e.g. if hosting on a UTC server but users expect IST).

const cron = require("node-cron");
const config = require("../config");
const ticketService = require("../services/ticketService");
const lotteryService = require("../services/lotteryService");
const db = require("../db/connection");

// Set this to your target timezone, e.g. "Asia/Kolkata", "America/New_York".
// Leaving it unset means "use the server's local timezone".
const TIMEZONE = process.env.CRON_TIMEZONE || undefined;

function cronOptions() {
  return TIMEZONE ? { timezone: TIMEZONE } : {};
}

function startLotteryCronJobs() {
  const { salesCloseHour, drawHour } = config.game;

  // --- Close sales & commit seed ---
  cron.schedule(
    `0 ${salesCloseHour} * * *`,
    () => {
      const today = ticketService.todayDateString();
      console.log(`[CRON] ${new Date().toISOString()} — closing sales for ${today}`);
      try {
        lotteryService.closeSalesAndCommitSeed(today);
      } catch (err) {
        console.error("[CRON] Failed to close sales:", err);
      }
    },
    cronOptions()
  );

  // --- Run the draw ---
  cron.schedule(
    `0 ${drawHour} * * *`,
    () => {
      const today = ticketService.todayDateString();
      console.log(`[CRON] ${new Date().toISOString()} — running draw for ${today}`);
      try {
        const result = lotteryService.runDraw(today);
        console.log("[CRON] Draw result:", result);
        // TODO: send a Telegram broadcast message announcing the winner here,
        // using your bot's sendMessage API — left out since it depends on
        // which Telegram bot library you choose (node-telegram-bot-api, grammY, etc).
      } catch (err) {
        console.error("[CRON] Failed to run draw:", err);
      }
    },
    cronOptions()
  );

  // --- Housekeeping: pre-create tomorrow's draw row at 00:01 ---
  cron.schedule(
    "1 0 * * *",
    () => {
      const today = ticketService.todayDateString();
      const exists = db.prepare("SELECT 1 FROM draws WHERE draw_date = ?").get(today);
      if (!exists) {
        db.prepare("INSERT INTO draws (draw_date, status) VALUES (?, 'open')").run(today);
        console.log(`[CRON] Created draw row for ${today}`);
      }
    },
    cronOptions()
  );

  console.log(
    `[CRON] Lottery jobs scheduled — sales close at ${salesCloseHour}:00, draw at ${drawHour}:00${
      TIMEZONE ? ` (${TIMEZONE})` : " (server local time)"
    }`
  );
}

module.exports = { startLotteryCronJobs };

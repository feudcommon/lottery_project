const cron = require("node-cron");
const config = require("../config");
const ticketService = require("../services/ticketService");
const lotteryService = require("../services/lotteryService");
const db = require("../db/connection");
const jackpotService = require("../services/jackpotService");

const TIMEZONE = process.env.CRON_TIMEZONE;
let cronTimezone;

if (TIMEZONE) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: TIMEZONE });
    cronTimezone = TIMEZONE;
  } catch {
    throw new Error(`Invalid CRON_TIMEZONE: ${TIMEZONE}`);
  }
}

function cronOptions() {
  return cronTimezone ? { timezone: cronTimezone } : {};
}

function startLotteryCronJobs() {
  const { salesCloseHour, drawHour } = config.game;

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
    cronOptions(),
  );

  cron.schedule(
    `0 ${drawHour} * * *`,
    () => {
      const today = ticketService.todayDateString();
      console.log(`[CRON] ${new Date().toISOString()} — running draw for ${today}`);
      try {
        const result = lotteryService.runDraw(today);
        console.log("[CRON] Draw result:", result);
      } catch (err) {
        console.error("[CRON] Failed to run draw:", err);
      }
    },
    cronOptions(),
  );

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
    cronOptions(),
  );

  console.log(
    `[CRON] Lottery jobs scheduled — sales close at ${salesCloseHour}:00, draw at ${drawHour}:00${
      cronTimezone ? ` (${cronTimezone})` : " (server local time)"
    }`,
  );

  cron.schedule(
    `0 ${config.game.drawHour} * * 0`,
    () => {
      const { weekStart } = jackpotService.getWeekBounds();
      console.log(`[CRON] Closing jackpot week ${weekStart}`);
      try {
        jackpotService.closeWeekAndCommitSeed(weekStart);
      } catch (err) {
        console.error("[CRON] Failed to close jackpot week:", err);
      }
    },
    cronOptions(),
  );

  cron.schedule(
    `30 ${config.game.drawHour} * * 0`,
    () => {
      const { weekStart } = jackpotService.getWeekBounds();
      console.log(`[CRON] Running jackpot draw for week ${weekStart}`);
      try {
        const result = jackpotService.runJackpotDraw(weekStart);
        console.log("[CRON] Jackpot result:", result);
      } catch (err) {
        console.error("[CRON] Failed to run jackpot draw:", err);
      }
    },
    cronOptions(),
  );
}

module.exports = { startLotteryCronJobs };
// src/services/drawsService.js
const db = require("../db/connection");

/**
 * Get draw history - last N days
 */
function getDrawHistory(days = 7) {
  const draws = db.prepare(`
    SELECT * FROM draws 
    ORDER BY draw_date DESC 
    LIMIT ?
  `).all(days);
  
  return draws || [];
}

/**
 * Get today's draw
 */
function getTodaysDraw() {
  // ─── PATCH ──────────────────────────────────────────────────────────────
  // Was: new Date().toISOString().slice(0, 10) — always UTC, regardless of
  // CRON_TIMEZONE. That disagreed with the Asia/Kolkata-scheduled cron jobs
  // for ~5.5 hours around midnight IST. Use the same timezone-aware helper
  // pattern as ticketService.todayDateString() so all "today" calculations
  // agree across the app.
  // ───────────────────────────────────────────────────────────────────────
  const tz = process.env.CRON_TIMEZONE || "UTC";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // 'YYYY-MM-DD' in configured tz

  const draw = db.prepare(`
    SELECT * FROM draws 
    WHERE draw_date = ?
  `).get(today);
  
  return draw || { date: today, status: 'pending', total_tickets_sold: 0 };
}

/**
 * Get draw by date
 */
function getDrawByDate(date) {
  return db.prepare(`
    SELECT * FROM draws 
    WHERE draw_date = ?
  `).get(date);
}

module.exports = {
  getDrawHistory,
  getTodaysDraw,
  getDrawByDate,
};
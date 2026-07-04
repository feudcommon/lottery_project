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
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  
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
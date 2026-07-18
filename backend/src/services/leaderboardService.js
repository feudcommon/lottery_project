// src/services/leaderboardService.js
const db = require("../db/connection");

function getTopByCoins(limit = 20) {
  return db.prepare(`
    SELECT id, username, coins, referral_count
    FROM users
    WHERE is_banned = 0
    ORDER BY coins DESC
    LIMIT ?
  `).all(limit);
}

// Returns the requesting user's rank (1-indexed) even if outside the top N
function getUserRank(userId) {
  const row = db.prepare(`
    SELECT rank FROM (
      SELECT id, RANK() OVER (ORDER BY coins DESC) as rank
      FROM users WHERE is_banned = 0
    ) WHERE id = ?
  `).get(userId);
  return row ? row.rank : null;
}

module.exports = { getTopByCoins, getUserRank };
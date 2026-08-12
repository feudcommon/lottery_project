// src/services/notificationService.js
//
// In-app notifications. These are the fallback (and, for wallet-only
// users, the ONLY) way to tell someone they've won — Telegram DMs only
// reach users who logged in via Telegram and have opened a chat with the
// bot. This gives every user a "you won!" banner next time they open the
// site, regardless of how they log in.

const db = require("../db/connection");

async function createNotification({ userId, type, title, message, referenceId = null }) {
  await db.prepare(`
    INSERT INTO notifications (user_id, type, title, message, reference_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, type, title, message, referenceId);
}

async function getMyNotifications(userId, { unreadOnly = false, limit = 20 } = {}) {
  const rows = unreadOnly
    ? await db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? AND is_read = 0
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, limit)
    : await db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, limit);

  return rows || [];
}

async function markAsRead(userId, notificationId) {
  await db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND user_id = ?
  `).run(notificationId, userId);
}

async function markAllAsRead(userId) {
  await db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE user_id = ? AND is_read = 0
  `).run(userId);
}

module.exports = {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
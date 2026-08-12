// src/controllers/notificationController.js

const { asyncHandler } = require("../middleware/errorHandler");
const notificationService = require("../services/notificationService");

// GET /api/notifications?unreadOnly=true
const getMyNotifications = asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unreadOnly === "true";
  const notifications = await notificationService.getMyNotifications(req.user.id, { unreadOnly });
  res.json({ notifications });
});

// POST /api/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await notificationService.markAsRead(req.user.id, id);
  res.json({ success: true });
});

// POST /api/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.json({ success: true });
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead };
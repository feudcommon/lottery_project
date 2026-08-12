// src/routes/notificationRoutes.js

const express = require("express");
const router = express.Router();

const { getMyNotifications, markAsRead, markAllAsRead } = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");

// GET /api/notifications  -- current user's notifications (most recent first)
router.get("/", requireAuth, getMyNotifications);

// POST /api/notifications/:id/read  -- mark one as read
router.post("/:id/read", requireAuth, markAsRead);

// POST /api/notifications/read-all  -- mark everything as read
router.post("/read-all", requireAuth, markAllAsRead);

module.exports = router;
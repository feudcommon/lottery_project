// src/routes/userRoutes.js

const express = require("express");
const router = express.Router();

const { getCoins, getMe, getMyHistory } = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");

// GET /api/user/me  -- full profile of the logged-in user
router.get("/me", requireAuth, getMe);

// GET /api/user/:id/coins  -- matches the spec's exact endpoint shape
router.get("/:id/coins", requireAuth, getCoins);

// GET /api/user/me/history  -- coin transaction ledger
router.get("/me/history", requireAuth, getMyHistory);

module.exports = router;

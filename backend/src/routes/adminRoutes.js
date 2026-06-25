// src/routes/adminRoutes.js

const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Every route here requires BOTH a valid login AND admin status.
// Order matters: requireAuth populates req.user, requireAdmin reads it.
router.use(requireAuth, requireAdmin);

router.get("/users", adminController.listUsers);
router.get("/tickets/:date", adminController.getTicketSales);
router.get("/withdrawals/pending", adminController.getPendingWithdrawals);
router.post("/withdrawals/:id/approve", adminController.approveWithdrawal);
router.post("/withdrawals/:id/reject", adminController.rejectWithdrawal);
router.post("/draw/:date/run", adminController.forceDraw);

module.exports = router;

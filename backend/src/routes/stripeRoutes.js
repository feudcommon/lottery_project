const express = require("express");
const {
  getPublicConfig,
  createCheckoutSession,
  handleWebhookEvent,
  constructWebhookEvent,
  getMyFiatDeposits,
  getDepositBySessionId,
} = require("../services/stripeService");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/config",
  asyncHandler(async (req, res) => {
    res.json(getPublicConfig());
  }),
);

router.post(
  "/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amountUsdCents } = req.body;
    const result = await createCheckoutSession(req.user.id, amountUsdCents);
    res.json(result);
  }),
);

// Body already made raw by the app-level middleware in app.js (must run
// before the global express.json() there — see comment in app.js).
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const event = constructWebhookEvent(req.body, signature);
    await handleWebhookEvent(event);
    res.json({ received: true });
  }),
);

router.get(
  "/deposits",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(getMyFiatDeposits(req.user.id));
  }),
);

router.get(
  "/deposit/:sessionId",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(getDepositBySessionId(req.user.id, req.params.sessionId));
  }),
);

module.exports = router;
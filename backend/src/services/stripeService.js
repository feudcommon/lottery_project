// src/services/stripeService.js
//
// FIAT (CARD) COIN PURCHASE VIA STRIPE CHECKOUT
//
// Flow:
//   1. Frontend calls POST /api/stripe/checkout with a USD amount.
//   2. We create a Stripe Checkout Session (Stripe-hosted payment page) and
//      record a 'pending' row in fiat_deposits, keyed by the session id.
//   3. We return the session URL; the frontend redirects the user there.
//   4. User pays on Stripe's page. Stripe redirects them back to successUrl
//      or cancelUrl — but that redirect is NOT trusted for crediting coins,
//      since a user can hit "back" or the URL can be replayed/faked.
//   5. The SOURCE OF TRUTH is the `checkout.session.completed` webhook,
//      verified with the webhook signing secret. That's the only place
//      coins actually get credited.
//   6. Crediting is idempotent: fiat_deposits.stripe_session_id is UNIQUE,
//      and we check status='pending' before crediting, so a retried/
//      duplicated webhook delivery (Stripe explicitly warns these happen)
//      can never double-credit a user.

const Stripe = require("stripe");
const db = require("../db/connection");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

if (!config.stripe.secretKey) {
  console.warn("Stripe not configured. Missing STRIPE_SECRET_KEY. Fiat purchases will be unavailable.");
}

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

function requireStripeConfigured() {
  if (!stripe) {
    throw new AppError("Card purchases are not configured on this server.", 503);
  }
}

// GET /api/stripe/config — lets the frontend render pricing without
// hardcoding it, and know the allowed min/max before showing the form.
function getPublicConfig() {
  return {
    enabled: !!stripe,
    coinsPerUsd: config.stripe.coinsPerUsd,
    minAmountUsdCents: config.stripe.minAmountUsdCents,
    maxAmountUsdCents: config.stripe.maxAmountUsdCents,
  };
}

async function createCheckoutSession(userId, amountUsdCents) {
  requireStripeConfigured();

  if (
    !Number.isInteger(amountUsdCents) ||
    amountUsdCents < config.stripe.minAmountUsdCents ||
    amountUsdCents > config.stripe.maxAmountUsdCents
  ) {
    throw new AppError(
      `Amount must be between ${config.stripe.minAmountUsdCents / 100} and ${
        config.stripe.maxAmountUsdCents / 100
      } USD.`,
      400
    );
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new AppError("User not found", 404);
  if (user.is_banned) throw new AppError("Account suspended", 403);

  const coinsForAmount = Math.floor((amountUsdCents / 100) * config.stripe.coinsPerUsd);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `SCAI Lucky Loop — ${coinsForAmount} coins`,
          },
          unit_amount: amountUsdCents,
        },
        quantity: 1,
      },
    ],
    // Carried through to the webhook event so we can match it back to a
    // user without trusting anything else on the request.
    client_reference_id: String(userId),
    metadata: {
      userId: String(userId),
      coinsForAmount: String(coinsForAmount),
    },
    success_url: `${config.stripe.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.stripe.cancelUrl,
  });

  db.prepare(`
    INSERT INTO fiat_deposits (user_id, stripe_session_id, amount_usd_cents, coins_credited, status)
    VALUES (?, ?, ?, 0, 'pending')
  `).run(userId, session.id, amountUsdCents);

  return { checkoutUrl: session.url, sessionId: session.id, coinsForAmount };
}

// Called only from the webhook handler, after signature verification.
// Credits coins exactly once per session.
function creditFiatDeposit(session) {
  const deposit = db.prepare("SELECT * FROM fiat_deposits WHERE stripe_session_id = ?").get(session.id);
  if (!deposit) {
    // Shouldn't happen (we always create the row before redirecting the
    // user), but don't let an unrecognized session crash the webhook.
    console.error(`Webhook for unknown session ${session.id}`);
    return null;
  }
  if (deposit.status !== "pending") {
    // Already handled — Stripe retries webhooks, this makes retries a no-op.
    return deposit;
  }
  if (session.payment_status !== "paid") {
    return deposit;
  }

  const coinsToCredit = Math.floor((deposit.amount_usd_cents / 100) * config.stripe.coinsPerUsd);

  const result = db.transaction(() => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(deposit.user_id);
    if (!user) throw new AppError("User not found", 404);

    const newBalance = user.coins + coinsToCredit;
    db.prepare("UPDATE users SET coins = ? WHERE id = ?").run(newBalance, user.id);

    db.prepare(`
      UPDATE fiat_deposits
      SET status = 'completed', coins_credited = ?, stripe_payment_intent_id = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(coinsToCredit, session.payment_intent || null, deposit.id);

    db.prepare(`
      INSERT INTO coin_transactions (user_id, amount, reason, reference_id, balance_after)
      VALUES (?, ?, 'fiat_deposit', ?, ?)
    `).run(user.id, coinsToCredit, deposit.id, newBalance);

    return { depositId: deposit.id, coinsCredited: coinsToCredit, newBalance };
  })();

  return result;
}

function markFiatDepositFailed(session) {
  db.prepare(`
    UPDATE fiat_deposits SET status = 'failed' WHERE stripe_session_id = ? AND status = 'pending'
  `).run(session.id);
}

// Raw Stripe event handler — routes by event type. Keep this small and
// defensive: webhook handlers must never throw on events they don't care
// about, or Stripe will keep retrying forever.
function handleWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return creditFiatDeposit(event.data.object);
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      markFiatDepositFailed(event.data.object);
      return null;
    default:
      return null; // ignore anything we don't handle
  }
}

// Verifies the Stripe signature on the raw request body. MUST be called
// with the unparsed body buffer — see app.js for why this route is mounted
// before express.json().
function constructWebhookEvent(rawBody, signature) {
  requireStripeConfigured();
  if (!config.stripe.webhookSecret) {
    throw new AppError("Webhook secret not configured.", 503);
  }
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}

function getMyFiatDeposits(userId) {
  return db
    .prepare("SELECT * FROM fiat_deposits WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);
}

// Lets the frontend poll "did my session actually get credited yet?" right
// after the Stripe redirect, without trusting the redirect itself.
function getDepositBySessionId(userId, sessionId) {
  return db
    .prepare("SELECT * FROM fiat_deposits WHERE user_id = ? AND stripe_session_id = ?")
    .get(userId, sessionId);
}

module.exports = {
  getPublicConfig,
  createCheckoutSession,
  handleWebhookEvent,
  constructWebhookEvent,
  getMyFiatDeposits,
  getDepositBySessionId,
};
// src/utils/telegramAuth.js
//
// HOW TELEGRAM LOGIN WORKS (important to understand, not just copy-paste):
//
// 1. User opens your Telegram bot / Web App.
// 2. Telegram itself signs a data payload (user id, name, auth_date, etc.)
//    using YOUR bot token as the secret key (HMAC-SHA256).
// 3. Telegram hands that signed payload to your frontend (the Web App or
//    the "Login Widget").
// 4. Your frontend sends that payload to YOUR backend.
// 5. Your backend re-computes the HMAC using the bot token and checks it
//    matches the "hash" field Telegram provided.
//
// If it matches, you KNOW Telegram actually issued this login (because only
// Telegram and you know the bot token, and only Telegram can produce a valid
// hash for a given user/auth_date without knowing the secret).
//
// If you skipped this and just trusted whatever "telegram_id" the client
// sent you, anyone could pretend to be any user by sending a fake id —
// that's the whole vulnerability this function closes.
//
// This implementation supports Telegram Web App initData verification,
// which is what you get from a Telegram Mini App (the modern way to build
// these games). If you're using the older "Login Widget" instead, the
// fields differ slightly — see the comment at the bottom.

const crypto = require("crypto");
const config = require("../config");

/**
 * Verifies Telegram WebApp initData string.
 * @param {string} initData - the raw initData string sent by the Telegram client
 * @returns {{ valid: boolean, data?: object, error?: string }}
 */
function verifyTelegramWebAppData(initData) {
  if (!initData || typeof initData !== "string") {
    return { valid: false, error: "Missing initData" };
  }

  const botToken = config.telegram.botToken;
  if (!botToken) {
    return { valid: false, error: "Server misconfigured: no bot token set" };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return { valid: false, error: "Missing hash field" };
  }
  params.delete("hash");

  // Build the data-check-string: all fields sorted alphabetically, joined by \n
  const pairs = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  // secret_key = HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

  // computed_hash = HMAC_SHA256(data_check_string, secret_key)
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) {
    return { valid: false, error: "Invalid signature — possible spoofing attempt" };
  }

  // Optional but recommended: reject stale logins (replay protection)
  const authDate = parseInt(params.get("auth_date") || "0", 10);
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  const MAX_AGE_SECONDS = 24 * 60 * 60; // 24h
  if (ageSeconds > MAX_AGE_SECONDS) {
    return { valid: false, error: "Login data expired, please reopen the app" };
  }

  let user;
  try {
    user = JSON.parse(params.get("user") || "{}");
  } catch {
    return { valid: false, error: "Malformed user field" };
  }

  return {
    valid: true,
    data: {
      telegramId: String(user.id),
      username: user.username || user.first_name || `user_${user.id}`,
      authDate,
    },
  };
}

module.exports = { verifyTelegramWebAppData };

// ---------------------------------------------------------------------------
// NOTE ON THE OLDER "LOGIN WIDGET" FLOW (telegram.org/js/telegram-widget.js):
// The verification math is the SAME (HMAC-SHA256 with bot token), but the
// secret key step differs slightly:
//   secret_key = SHA256(bot_token)              <-- not HMAC, plain SHA256
//   computed_hash = HMAC_SHA256(data_check_string, secret_key)
// And fields come individually (id, first_name, username, auth_date, hash)
// rather than packed inside a "user" JSON field. If you use the widget
// instead of a Mini App, swap that one line and adjust field parsing.
// ---------------------------------------------------------------------------

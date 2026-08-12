// src/services/telegramService.js
//
// Minimal wrapper around the Telegram Bot API's sendMessage method, used to
// DM users directly (e.g. to tell them they've won a draw). Uses the same
// TELEGRAM_BOT_TOKEN already configured for the login widget — no new env
// vars needed.
//
// Node 22+ has global fetch, so no extra HTTP dependency is required.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.warn(
    "[Telegram] TELEGRAM_BOT_TOKEN not set — winner notifications will be skipped.",
  );
}

/**
 * Send a message to a single Telegram user.
 * Never throws — notification failures should never break a draw/withdrawal
 * flow. Returns true on success, false otherwise.
 */
async function sendTelegramMessage(telegramId, text) {
  if (!BOT_TOKEN) return false;
  if (!telegramId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      // Common cause: the user has never opened a DM with the bot, so
      // Telegram refuses to deliver ("Forbidden: bot can't initiate
      // conversation with a user" / "chat not found"). This is expected for
      // some users and shouldn't be treated as a hard failure.
      console.warn(`[Telegram] sendMessage failed for ${telegramId}:`, data.description);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Telegram] sendMessage error for ${telegramId}:`, error.message);
    return false;
  }
}

module.exports = { sendTelegramMessage };
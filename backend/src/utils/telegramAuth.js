const crypto = require("crypto");
const config = require("../config");

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

  const pairs = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) {
    return { valid: false, error: "Invalid signature — possible spoofing attempt" };
  }

  const authDate = parseInt(params.get("auth_date") || "0", 10);
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  const MAX_AGE_SECONDS = 24 * 60 * 60;
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

function verifyTelegramLoginWidgetData(payload) {
  if (!payload || typeof payload !== "object") return { valid: false, error: "Missing Telegram login data" };
  const botToken = config.telegram.botToken;
  if (!botToken) return { valid: false, error: "Server misconfigured: no bot token set" };
  const { hash, id, auth_date: authDate, username, first_name: firstName } = payload;
  if (!hash || !id || !authDate) return { valid: false, error: "Incomplete Telegram login data" };
  const pairs = Object.entries(payload)
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(pairs.join("\n")).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(String(hash)))) {
    return { valid: false, error: "Invalid Telegram Login Widget signature" };
  }
  if (Math.floor(Date.now() / 1000) - Number(authDate) > 24 * 60 * 60) {
    return { valid: false, error: "Telegram login data expired. Please sign in again." };
  }
  return { valid: true, data: { telegramId: String(id), username: username || firstName || `user_${id}` } };
}

module.exports.verifyTelegramLoginWidgetData = verifyTelegramLoginWidgetData;
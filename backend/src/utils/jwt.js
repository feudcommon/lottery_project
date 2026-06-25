// src/utils/jwt.js
//
// JWT (JSON Web Token) in plain terms:
// - It's a signed string the server hands to the client after login.
// - The client sends it back on every request (Authorization: Bearer <token>).
// - The server verifies the SIGNATURE (not a database lookup) to confirm
//   "yes, I issued this, and nobody tampered with it."
// - Inside the token (the "payload") we put just enough info to identify
//   the user: their internal user id and telegram id. NEVER put secrets
//   (passwords, wallet private keys) inside a JWT — it's signed, not encrypted,
//   so anyone can decode and read the payload (just not forge it).

const jwt = require("jsonwebtoken");
const config = require("../config");

function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,               // "subject" = internal user id, standard claim name
      telegramId: user.telegram_id,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function verifyToken(token) {
  // Throws if invalid/expired — caller should catch
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { signUserToken, verifyToken };

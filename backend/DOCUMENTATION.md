# SCAI Lucky Loop — Backend Concepts Explained

This document walks through every topic from your list, explains what it is, why it matters specifically for a coin-based lottery app, and points to exactly where it's implemented in the code (`/src/...`). Read this alongside the actual files — the code has detailed comments too, but this is the "why" behind each decision.

---

## 1. REST API design

**What it is:** REST (Representational State Transfer) is just a convention for organizing your API: resources are nouns (`/user`, `/tickets`), actions are HTTP verbs (`GET` to read, `POST` to create/trigger an action), and each endpoint does one clear thing.

**Why it matters here:** A lottery app moves money (coins, eventually tokens), so ambiguity in your API is dangerous. If "buy a ticket" and "check ticket status" used the same endpoint with different parameters, it's much easier to introduce a bug where one accidentally triggers the other.

**What's implemented:**

| Endpoint | Verb | What it does |
|---|---|---|
| `/api/auth/telegram` | POST | Exchanges Telegram login data for a JWT |
| `/api/buy-ticket` | POST | Buys one lottery ticket (an action, hence POST) |
| `/api/user/:id/coins` | GET | Reads a balance (read-only, hence GET) |
| `/api/withdraw` | POST | Triggers a withdrawal request |
| `/api/draws/:date` | GET | Reads a public draw result |

A subtlety worth noticing in `GET /api/user/:id/coins`: even though the user's ID is sitting right there in the URL, the controller (`src/controllers/userController.js`) still checks that the ID matches the logged-in user before returning anything. Without that check, anyone logged in as user 12 could just change the URL to `/api/user/47/coins` and see user 47's balance. The URL parameter is never trusted on its own — it's always cross-checked against who's actually authenticated.

---

## 2. Express.js routing & middleware

**What it is:** Express is the Node.js framework handling HTTP requests. "Middleware" is any function that runs *before* your actual route logic — it can inspect the request, modify it, reject it outright, or just pass it along by calling `next()`.

**Why it matters here:** Instead of writing "check the user is logged in" and "validate this input" inside every single route handler (and inevitably forgetting it somewhere), middleware lets you declare those checks once and stack them onto whichever routes need them.

**What's implemented:** Look at `src/routes/ticketRoutes.js`:

```js
router.post("/buy-ticket", requireAuth, buyTicketLimiter, validate(buyTicketSchema), buyTicket);
```

Read that left to right — it's the exact order the request passes through: first `requireAuth` checks the JWT, then `buyTicketLimiter` checks they're not spamming the endpoint, then `validate` checks the request body shape, and only if all three pass does the actual `buyTicket` controller run. Each piece can reject the request and stop it right there, so the actual business logic in the controller never even has to think about "is this person logged in" — by the time it runs, that's already guaranteed.

The full middleware stack is assembled in `src/app.js`, where you can see the global ones (`helmet` for security headers, `cors`, the JSON body parser, the global rate limiter) applied to every request, before any specific route is even matched.

---

## 3. JWT authentication (+ Telegram login)

**What it is:** JWT (JSON Web Token) is a signed string the server hands a client after login. The client sends it back on every subsequent request (`Authorization: Bearer <token>`), and the server checks the *signature* — not a database lookup — to confirm "yes, I issued this, nobody tampered with it."

**Why it matters here:** Buying tickets and withdrawing money must only be possible for the actual logged-in user. Without this, anyone could send a request claiming to be any user ID they want.

**The two-step trust chain, which is the part people often get wrong:**

1. **Telegram → your backend:** When a user opens your Telegram Mini App, Telegram itself cryptographically signs a payload (their user ID, username, a timestamp) using your bot token as the secret key. Your backend's job (`src/utils/telegramAuth.js`) is to re-compute that same signature using the same bot token and check it matches. If it matches, you *know* Telegram genuinely issued this login — nobody could forge it without knowing your bot token.

2. **Your backend → the client, for everything after that:** Once Telegram login is verified, your backend issues its *own* JWT (`src/utils/jwt.js`), signed with your own secret (`JWT_SECRET`). The client uses *this* token for every future request — not the Telegram data, which is single-use and time-limited.

I tested this signature-checking logic in isolation (no real Telegram needed) and confirmed: a validly-signed payload is accepted, a spoofed payload (faked without the real bot token) is rejected, and — importantly — a *tampered* payload (someone takes a real valid payload, changes the user ID, but reuses the old signature) is also correctly rejected. That last case is the realistic attack, and it fails exactly as it should.

**What's implemented:** `src/middleware/auth.js` has `requireAuth`, which every protected route uses. It re-fetches the user from the database on every request (rather than trusting whatever was in the token when it was issued), so if you ban a user mid-session, their *next* request gets rejected immediately — their old token doesn't keep working just because it hasn't expired yet.

---

## 4. Cron jobs (node-cron)

**What it is:** A way to schedule a function to run automatically at specific times, using "cron syntax" (`minute hour day month weekday`).

**Why it matters here:** The lottery has a fixed daily schedule — sales close at 15:00, the draw happens at 18:00 — and this needs to happen reliably every single day without anyone manually clicking a button. If it relied on a human remembering to trigger it, one missed day breaks user trust immediately.

**What's implemented:** `src/jobs/lotteryCron.js` registers three scheduled jobs:

- `0 15 * * *` → closes ticket sales and "commits" the random seed for that day (explained in the next section)
- `0 18 * * *` → runs the actual draw using that committed seed
- `1 0 * * *` → housekeeping: creates tomorrow's draw record just after midnight

One thing worth flagging explicitly: cron schedules run in whatever timezone the server itself is set to, unless you override it. If your users expect "18:00" to mean their local time and your server is on UTC, you'll want to set `CRON_TIMEZONE` in your `.env` — the code already supports this, it just needs the value filled in for your deployment.

---

## 5. Server-side randomness

**What it is:** Picking the winner using server-controlled logic, so a client (a hacked Telegram Mini App, a modified frontend) has zero ability to influence or predict the result.

**Why your original plan needed strengthening:** Your spec used `Math.random()`, which *is* safe in the sense that it runs server-side and the client can't touch it — but it has two real gaps:

1. `Math.random()` isn't cryptographically secure. Given enough samples, its output is theoretically predictable, which matters a lot once real tokens are at stake.
2. Even with perfectly fair randomness, users have *no way to verify* that you didn't just quietly pick whoever you wanted. "Trust me" isn't good enough once money is involved.

**What's implemented instead — a commit-reveal scheme:**

- At sales-close time (15:00), the server generates a cryptographically secure random seed (`crypto.randomBytes`, not `Math.random()`), and immediately publishes a SHA-256 *hash* of that seed — but keeps the actual seed secret.
- At draw time (18:00), the server uses that already-committed seed to deterministically pick the winning ticket, *then* reveals the seed.
- Anyone — not just you — can now take the revealed seed, hash it themselves, and confirm it matches the hash that was published *before* the draw happened. If it matches, that proves the outcome was locked in before anyone (including you) knew who would win.

I ran a standalone test of exactly this logic: 1000 simulated draws showed a reasonably uniform spread across ticket slots (no single slot way over- or under-represented), the hash-matching verification correctly passes for a genuine seed, and correctly *fails* if someone tries to swap in a different seed after the fact — meaning tampering is detectable, not just theoretically impossible.

This lives in `src/services/lotteryService.js`, and there's a public endpoint, `GET /api/draws/:date/verify`, specifically so this verification isn't something only you can do internally — anyone can call it and check a past draw themselves. That endpoint is the literal implementation of the "blockchain-based randomness (fair & transparent)" goal from your spec, just using cryptographic commitments instead of an on-chain VRF — a reasonable stepping stone before you need the full complexity of something like Chainlink VRF.

---

## 6. Input validation (Zod)

**What it is:** Checking that incoming data matches the exact shape you expect — right types, required fields present, no unexpected garbage — *before* any of it touches your database or business logic.

**Why it matters here:** Without this, someone could send `{"amountCoins": -999999}` to the withdrawal endpoint, or a wallet address that isn't actually a valid address, or extra unexpected fields designed to confuse your logic. Validation rejects all of that at the door, with a clear error message, before it can do any damage.

**What's implemented:** `src/middleware/validate.js` defines a schema per endpoint. For example, the withdrawal schema:

```js
const withdrawSchema = z.object({
  walletAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM wallet address"),
  amountCoins: z.number().int("Must be a whole number").positive("Must be positive"),
});
```

This rejects anything that isn't a real-looking Ethereum-style address, and rejects negative or fractional coin amounts outright — both common ways an attacker (or just a buggy frontend) might send malformed data.

---

## 7. Rate limiting (express-rate-limit)

**What it is:** Capping how many requests a single client (by IP address, by default) can make in a given time window, and rejecting the rest with a `429 Too Many Requests`.

**Why it matters here:** Your spin/earn endpoint is literally a free-coin faucet. If someone scripts a loop that hits it as fast as possible, and your only protection is the cooldown logic *inside* that endpoint, you're relying on that logic having zero bugs, forever. Rate limiting is a second, independent layer of defense that doesn't care about your business logic at all — it just says "this IP made too many requests, slow down," full stop.

**What's implemented:** `src/middleware/rateLimiter.js` defines different limits for different sensitivity levels — login attempts get a generous allowance, spins get a tight one (3 per minute), withdrawals get the tightest (5 per hour), since that's the endpoint that actually moves value out of the system.

One caveat worth knowing for when you scale up: the default rate limiter stores its counters in memory. If you ever run more than one server process behind a load balancer, each process has its *own* counter, meaning the real limit becomes (your configured limit) × (number of processes) — which defeats the purpose. The code has a comment flagging exactly where to swap in a Redis-backed store when you get there; it's a one-line change, just not something to do prematurely.

---

## How these all combine for one request

Walking through `POST /api/buy-ticket` end to end ties everything together:

1. **Rate limiter** checks this IP hasn't exceeded 5 buy-attempts/minute.
2. **JWT middleware** verifies the Authorization header, decodes the token, re-fetches the user from the database (catching bans in real time), attaches `req.user`.
3. **Validation middleware** checks the request body matches the expected shape (optional `drawDate` field, correctly formatted if present).
4. **The controller** calls into `ticketService.buyTicket()`.
5. **Inside the service**, a database transaction checks: is the sales window currently open (the cron-driven schedule), has this user hit their 2-ticket limit, do they have enough coins, is there an unsold ticket slot left — and only if every check passes does it deduct coins and reserve the ticket, all as one atomic unit so a flood of simultaneous requests can never oversell tickets or double-charge a user.
6. **The response** comes back through the centralized error handler if anything failed at any step, or a success response if it all went through.

Every "must" and "good" item from your list shows up somewhere in that one request lifecycle — which is really the point: these aren't separate features bolted on, they're layers that all have to hold for a single ticket purchase to be safe.

---

## What to read next

- `README.md` in the project — setup instructions, how to run it locally, full endpoint table.
- `requests.http` — copy-pasteable example requests for every endpoint, including a note on testing locally without a real Telegram bot.
- The inline comments throughout `src/services/` — that's where almost all of the actual "why," not just "what," lives for the economy rules (ticket pricing, referral unlocking, withdrawal eligibility).

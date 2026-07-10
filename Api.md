# SCAI Lucky Loop — API Reference

Base URL: `https://<your-backend-host>` (locally, `http://localhost:3000`).

All authenticated endpoints require:
```
Authorization: Bearer <jwt>
```
Tokens are issued by `POST /api/auth/telegram` and expire after `JWT_EXPIRES_IN` (default 7d).

All error responses share this shape:
```json
{ "error": "Human-readable message" }
```
Validation errors from Zod additionally include a `details` array:
```json
{
  "error": "Validation failed",
  "details": [{ "field": "amountCoins", "message": "Must be positive" }]
}
```

---

## Health

### `GET /health`
No auth. Liveness probe for uptime monitoring / load balancers.

**Response**
```json
{ "status": "ok", "time": "2026-07-10T12:00:00.000Z" }
```

---

## Auth

### `POST /api/auth/telegram`
Rate limit: 10/min/IP. No auth required (this *is* the login).

Exchanges a Telegram Mini App `initData` payload (already signed by Telegram)
for a backend-issued JWT. Verification is HMAC-SHA256 against your bot
token — see `docs/ARCHITECTURE.md §3` for the trust chain.

**Body**
```json
{
  "initData": "auth_date=...&user=%7B...%7D&hash=...",
  "referralCode": "a1b2c3d4e5"   // optional
}
```

**Response `200`**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": 42,
    "username": "someuser",
    "coins": 0,
    "referralCode": "f9e8d7c6b5",
    "referralCount": 0,
    "walletAddress": null,
    "withdrawUnlocked": false
  }
}
```

**Errors**: `401` if the Telegram signature doesn't verify or has expired
(>24h old).

---

## User

### `GET /api/user/me`
Auth required. Returns the caller's own public profile (same shape as the
`user` object above).

### `GET /api/user/:id/coins`
Auth required. `:id` **must equal** the authenticated user's own id — this is
enforced server-side (`403` otherwise) regardless of what the URL says, to
prevent balance enumeration.

**Response**
```json
{ "userId": 42, "coins": 130 }
```

### `GET /api/user/me/history`
Auth required. Full coin transaction ledger for the caller, most recent
first (capped at 50 rows).

**Response**
```json
{
  "history": [
    { "id": 501, "user_id": 42, "amount": 10, "reason": "spin",
      "reference_id": null, "balance_after": 130, "created_at": "..." },
    { "id": 500, "user_id": 42, "amount": -10, "reason": "ticket_purchase",
      "reference_id": 88, "balance_after": 120, "created_at": "..." }
  ]
}
```

`reason` is one of: `spin`, `ticket_purchase`, `referral_bonus_for`,
`lottery_win`, `withdrawal`, `withdrawal_refund`.

---

## Coins

### `POST /api/spin`
Auth required. Rate limit: **3/min/IP** — this is the free-coin faucet, so it
gets the tightest limiter in the app. Also independently gated by a
24-hour per-user cooldown and a per-day earn cap
(`DAILY_EARN_CAP`, default 100), enforced inside the service layer, not just
the rate limiter.

**Body**: `{}` (no fields)

**Response `200`**
```json
{ "message": "You won 12 coins!", "reward": 12, "newBalance": 142 }
```

**Errors**: `429` if still on cooldown or the daily cap is reached (message
includes minutes remaining).

---

## Tickets

### `GET /api/tickets/today`
Auth required. Returns today's ticket board.

**Response**
```json
{
  "drawDate": "2026-07-10",
  "salesOpen": true,
  "tickets": [ { "ticket_number": 3, "user_id": 7, "...": "..." } ],
  "myTickets": [ { "ticket_number": 12, "...": "..." } ],
  "ticketsAvailable": 47
}
```

### `POST /api/buy-ticket`
Auth required. Rate limit: 5/min/IP. Only succeeds inside the configured
sales window (`SALES_OPEN_HOUR`–`SALES_CLOSE_HOUR`, in `CRON_TIMEZONE`).

**Body**
```json
{
  "drawDate": "2026-07-10",   // optional, defaults to today
  "slotNumber": 12            // optional 0-49; server auto-assigns if omitted
}
```

**Response `201`**
```json
{
  "message": "Ticket purchased!",
  "ticket": { "ticketId": 91, "ticketNumber": 12, "drawDate": "2026-07-10", "coinsRemaining": 110 }
}
```

**Errors** (`400`, all inside one atomic check): sales closed, per-user daily
limit (`MAX_TICKETS_PER_USER_PER_DAY`, default 2) reached, insufficient
coins, slot already sold, or sold out entirely.

---

## Draws

All draw endpoints are **public** — no auth required. This is deliberate: the
commit-reveal fairness scheme is only meaningful if anyone can independently
verify it, not just logged-in users.

### `GET /api/draws/history?days=7`
**Response**
```json
{ "draws": [ { "draw_date": "2026-07-09", "status": "drawn", "winner_user_id": 42, "...": "..." } ] }
```

### `GET /api/draws/:date`
Returns one draw. Before the draw has run, `randomSeed`, `winnerUserId`, and
`rewardAmount` are omitted — only the pre-committed hash is public, per the
commit-reveal design (see `ARCHITECTURE.md §4.1`).

**Response**
```json
{
  "drawDate": "2026-07-10",
  "status": "closed",
  "totalTicketsSold": 34,
  "serverSeedHash": "9f86d0818...",
  "randomSeed": undefined,
  "winnerUserId": undefined,
  "rewardAmount": undefined
}
```

### `GET /api/draws/:date/verify`
Recomputes `sha256(revealed_seed)` and the winning index from the revealed
seed, and reports whether both match what was recorded/published.

**Response**
```json
{
  "drawDate": "2026-07-09",
  "publishedHashBeforeDraw": "9f86d0818...",
  "revealedSeed": "a1b2c3...",
  "hashMatches": true,
  "recomputedWinnerTicketId": 88,
  "matchesRecordedWinner": true
}
```

---

## Withdrawal

### `GET /api/withdraw/eligibility`
Auth required.

**Response**
```json
{
  "eligible": false,
  "reasons": ["Need 1000 coins (you have 600)"],
  "minCoins": 1000,
  "minReferrals": 5,
  "currentCoins": 600,
  "referralCount": 5
}
```

### `POST /api/withdraw`
Auth required. Rate limit: 5/hour/IP. Blockchain call happens **before**
any coin deduction — see `ARCHITECTURE.md §6`. This call can take several
seconds (mint + transfer, each with retry/backoff on RPC flakiness).

**Body**
```json
{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0000",
  "amountCoins": 1000
}
```

**Response `201`**
```json
{
  "message": "Withdrawal request submitted and pending processing.",
  "withdrawal": {
    "withdrawalId": 5,
    "tokenAmount": 10,
    "coinsSpent": 1000,
    "newBalance": 0,
    "status": "completed",
    "txHash": "0x74a3f0...",
    "explorerUrl": "https://explorer.securechain.ai/tx/0x74a3f0..."
  }
}
```

**Errors**: `400` invalid wallet address / amount / below minimum, `403` not
eligible, `500` blockchain error (coins are **not** deducted in this case —
message says so explicitly), `503` blockchain not configured on the server.

### `GET /api/withdraw/history`
Auth required. All past withdrawal attempts for the caller.

---

## Admin

All routes below require `requireAuth` **and** `requireAdmin` (caller's
`telegram_id` must be in `ADMIN_TELEGRAM_IDS`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/users` | List up to 200 most recently created users |
| GET | `/api/admin/tickets/:date` | Ticket sales + draw state for one day |
| GET | `/api/admin/withdrawals/pending` | List withdrawals awaiting manual action |
| POST | `/api/admin/withdrawals/:id/approve` | Trigger on-chain send for a pending withdrawal |
| POST | `/api/admin/withdrawals/:id/reject` | Reject + refund coins to the user |
| POST | `/api/admin/draw/:date/run` | Force-run a draw outside the normal cron schedule |

`POST /api/admin/draw/:date/run` body: none required.
`POST /api/admin/withdrawals/:id/reject` body: `{ "reason": "string, optional" }`.

---

## Rate Limit Response

Any limiter rejection returns `429`:
```json
{ "error": "Too many requests, please slow down and try again shortly." }
```
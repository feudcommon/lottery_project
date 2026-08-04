# SCAI Lucky Loop — Backend

Node.js/Express API powering SCAI Lucky Loop: users (Telegram or wallet-only) earn coins, buy lottery tickets, get paid out via a provably-fair daily draw and weekly jackpot, top up coins on-chain or via Stripe, and withdraw earnings as on-chain LLT tokens.

See [`../architecture.md`](../architecture.md) and [`../Api.md`](../Api.md) for the full request/response reference and the *why* behind each piece (REST design, JWT, cron, commit-reveal randomness, validation, rate limiting).

## Quick start

```bash
npm install
cp .env.example .env
# edit .env — at minimum set JWT_SECRET and TELEGRAM_BOT_TOKEN
npm run init-db
npm run dev
```

Server starts on `http://localhost:3000`. Hit `GET /health` to confirm it's alive.

## Requirements

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather) for the Telegram login path — not required for the wallet-only login path
- No external database server — SQLite (file-based) via Node's built-in `node:sqlite` module (no native compile step, so no Windows build-tool setup needed)

## Project layout

```
src/
  app.js              Express app assembly (middleware + route mounting)
  server.js           Entry point — starts the HTTP server + cron jobs
  config/             All tunable numbers (ticket price, hours, limits, admin allowlists) read from .env
  db/
    init.js           Creates the SQLite schema (run once via `npm run init-db`)
    connection.js     Shared DB connection (node:sqlite) used everywhere else
  routes/             Express routers — one file per resource, just wiring
  controllers/        Request/response handling — thin, calls into services
  services/           All business logic (tickets, draws, jackpot, withdrawals, deposits, coins, users)
  middleware/         auth (requireAuth/requireAdmin), validation, rate limiting, error handling
  jobs/                node-cron schedule that runs the lottery automatically
  utils/               JWT signing/verification, Telegram signature verification, wallet nonce/signature verification
```

Routes only wire HTTP methods to controllers. Controllers only parse requests and format responses. Services hold all the actual rules (ticket limits, coin math, draw fairness, withdrawal eligibility). That separation keeps `services/` unit-testable without touching Express, and means swapping SQLite for Postgres later only touches `db/` and the SQL inside `services/`.

## Environment variables

See `.env.example` for the full list with comments. Must be set before running:

- `JWT_SECRET` — long random string; server refuses to start without it
- `TELEGRAM_BOT_TOKEN` — required for Telegram login verification (not needed if you only use wallet login)
- `ADMIN_TELEGRAM_IDS` — comma-separated Telegram user IDs allowed to hit `/api/admin/*`
- `ADMIN_WALLET_ADDRESSES` — comma-separated wallet addresses (any case; compared lowercase) allowed to hit `/api/admin/*`

Everything else (ticket price, sales hours, withdrawal thresholds) has working defaults. For on-chain withdrawals and deposits, also set `RPC_URL`, `BACKEND_PRIVATE_KEY`, and `LLT_CONTRACT_ADDRESS`. For Stripe fiat deposits, also set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.

`ADMIN_TELEGRAM_IDS` / `ADMIN_WALLET_ADDRESSES` only need to cover the *first* admin. Once one admin exists, they can grant `is_admin` to other accounts directly from the `/admin` panel — no env var edit or redeploy needed for that.

## API endpoints

Full reference with request/response bodies: [`../Api.md`](../Api.md). Summary:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/telegram` | none | Telegram Mini App login → JWT |
| POST | `/api/auth/telegram-browser` | none | Telegram Login Widget login → JWT |
| GET | `/api/auth/wallet/nonce` | none | Get a nonce to sign for wallet login |
| POST | `/api/auth/wallet` | none | Wallet-only login/signup (no Telegram) |
| POST | `/api/auth/wallet/link` | user | Attach a wallet to the logged-in account |
| GET | `/api/user/me` | user | Your full profile |
| GET | `/api/user/:id/coins` | user | Your coin balance (id must be your own) |
| GET | `/api/user/me/history` | user | Your coin transaction ledger |
| POST | `/api/spin` | user | Claim a free daily coin reward |
| GET | `/api/tickets/today` | user | Today's availability + your tickets |
| POST | `/api/buy-ticket` | user | Buy a lottery ticket (10 coins) |
| GET | `/api/deposit/info` | user | Treasury address + SCAI→coin rate |
| POST | `/api/deposit` | user | Credit coins after an on-chain SCAI deposit |
| GET | `/api/deposit/history` | user | Your past on-chain deposits |
| GET | `/api/stripe/config` | none | Public Stripe checkout config |
| POST | `/api/stripe/checkout` | user | Create a Stripe Checkout session |
| POST | `/api/stripe/webhook` | none (signature-verified) | Stripe payment confirmation |
| GET/POST | `/api/stripe/deposits*` | user | Your fiat deposit history |
| POST | `/api/withdraw` | user | Request a coin → token withdrawal |
| GET | `/api/withdraw/eligibility` | user | Check if withdrawal is unlocked yet |
| GET | `/api/withdraw/history` | user | Your past withdrawal requests |
| GET | `/api/draws/:date` | none | Public result for a given day |
| GET | `/api/draws/:date/verify` | none | Anyone can verify a draw was fair |
| GET | `/api/draws/history?days=7` | none | Recent draw history |
| GET | `/api/jackpot/status` | none | Current jackpot pool |
| GET | `/api/jackpot/history` | none | Past jackpot weeks |
| GET | `/api/jackpot/:weekStart/verify` | none | Verify jackpot fairness |
| GET | `/api/public/stats` | none | Aggregate public stats |
| GET/POST | `/api/admin/*` | admin | User list/promotion, ticket sales, withdrawal approval, manual draw/jackpot control |

## How the daily lottery runs

`src/jobs/lotteryCron.js` drives the whole lifecycle automatically:

- `SALES_CLOSE_HOUR` — sales close, a random seed is generated and its SHA-256 hash is published (commit step). This step also creates the day's `draws` row if nobody bought a ticket, so a quiet day still closes and draws cleanly instead of the job failing later.
- `DRAW_HOUR` — the committed seed picks a winner deterministically, then the seed is revealed
- `00:01` — housekeeping: pre-creates tomorrow's draw row

Anyone can independently verify a completed draw was fair via `GET /api/draws/:date/verify` — it recomputes the hash from the revealed seed and confirms it matches what was published *before* the draw ran, proving the outcome wasn't tampered with after the fact.

Cron times run in the server's timezone unless `CRON_TIMEZONE` is set (e.g. `Asia/Kolkata`).

## Testing without a live Telegram bot

Telegram login requires a cryptographically signed payload only Telegram can produce. For local development, see the bypass instructions in `requests.http`, or use the wallet-only login path instead, which needs no Telegram bot at all. **Remove any Telegram bypass before deploying.**

## Known operational notes

- **Blockchain flakiness:** the SCAI network occasionally drops a signed transaction silently rather than erroring. `blockchainService.js` retries mint/transfer calls up to 3 times with backoff (2s/4s/6s) before giving up — see `sendWithRetry`.
- **Fail-safe ordering:** `withdrawalService.js` always sends tokens on-chain *before* touching the database. If the blockchain call fails, no coins are deducted and no withdrawal record is created — money is never debited without a confirmed on-chain transfer. `depositService.js` follows the mirror-image rule: it only credits coins after independently confirming the deposit transaction on-chain, so it never trusts a client-submitted tx hash for an unconfirmed transfer.
- **Stripe webhook body:** `/api/stripe/webhook` is mounted with `express.raw()` before the global JSON parser in `app.js`. If you add new global body-parsing middleware, keep it after this line or webhook signature verification will break.
- **Container restarts on Render:** a `SIGTERM` in the logs without an accompanying stack trace is a platform-level restart (deploy, health check, resource limit), not an application crash — check Render's deployment history/metrics rather than app code.

## Deployment

Deployed on Render as a web service, running `npm start` from `backend/`. Set all required env vars (secrets, DB path, admin allowlists, RPC/Stripe keys) directly in the Render dashboard.
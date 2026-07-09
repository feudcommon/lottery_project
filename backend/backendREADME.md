# SCAI Lucky Loop — Backend

Node.js/Express API powering the SCAI Lucky Loop Telegram Mini App: Telegram-authenticated users earn coins, buy lottery tickets, get paid out via a provably-fair daily draw, and withdraw earnings as on-chain LLT tokens.

See **[`DOCUMENTATION.md`](./DOCUMENTATION.md)** for a deep dive into *why* each piece is built the way it is (REST design, JWT, cron, commit-reveal randomness, validation, rate limiting).

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
- A Telegram bot token from [@BotFather](https://t.me/BotFather) (for real login — see `requests.http` for a local dev bypass)
- No external database server — SQLite (file-based) via `better-sqlite3`

## Project layout

```
src/
  app.js              Express app assembly (middleware + route mounting)
  server.js           Entry point — starts the HTTP server + cron jobs
  config/             All tunable numbers (ticket price, hours, limits) read from .env
  db/
    init.js           Creates the SQLite schema (run once via `npm run init-db`)
    connection.js     Shared DB connection used everywhere else
  routes/             Express routers — one file per resource, just wiring
  controllers/        Request/response handling — thin, calls into services
  services/           All business logic (tickets, draws, withdrawals, coins, users)
  middleware/         auth, validation, rate limiting, error handling
  jobs/                node-cron schedule that runs the lottery automatically
  utils/               JWT signing/verification, Telegram signature verification
```

Routes only wire HTTP methods to controllers. Controllers only parse requests and format responses. Services hold all the actual rules (ticket limits, coin math, draw fairness, withdrawal eligibility). That separation keeps `services/` unit-testable without touching Express, and means swapping SQLite for Postgres later only touches `db/` and the SQL inside `services/`.

## Environment variables

See `.env.example` for the full list with comments. Must be set before running:

- `JWT_SECRET` — long random string; server refuses to start without it
- `TELEGRAM_BOT_TOKEN` — required for real Telegram login verification
- `ADMIN_TELEGRAM_IDS` — comma-separated Telegram user IDs allowed to hit `/api/admin/*`

Everything else (ticket price, sales hours, withdrawal thresholds) has working defaults. For on-chain withdrawals, also set `RPC_URL`, `BACKEND_PRIVATE_KEY`, and `LLT_CONTRACT_ADDRESS`.

## API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/telegram` | none | Exchange Telegram login data for a JWT |
| GET | `/api/user/me` | user | Your full profile |
| GET | `/api/user/:id/coins` | user | Your coin balance (id must be your own) |
| GET | `/api/user/me/history` | user | Your coin transaction ledger |
| POST | `/api/spin` | user | Claim a free daily coin reward |
| GET | `/api/tickets/today` | user | Today's availability + your tickets |
| POST | `/api/buy-ticket` | user | Buy a lottery ticket (10 coins) |
| POST | `/api/withdraw` | user | Request a coin → token withdrawal |
| GET | `/api/withdraw/eligibility` | user | Check if withdrawal is unlocked yet |
| GET | `/api/withdraw/history` | user | Your past withdrawal requests |
| GET | `/api/draws/:date` | none | Public result for a given day |
| GET | `/api/draws/:date/verify` | none | Anyone can verify a draw was fair |
| GET | `/api/draws/history?days=7` | none | Recent draw history |
| GET/POST | `/api/admin/*` | admin | User list, ticket sales, withdrawal approval, manual draw trigger |

Full example requests are in `requests.http`.

## How the daily lottery runs

`src/jobs/lotteryCron.js` drives the whole lifecycle automatically:

- `SALES_CLOSE_HOUR` — sales close, a random seed is generated and its SHA-256 hash is published (commit step)
- `DRAW_HOUR` — the committed seed picks a winner deterministically, then the seed is revealed
- `00:01` — housekeeping: pre-creates tomorrow's draw row

Anyone can independently verify a completed draw was fair via `GET /api/draws/:date/verify` — it recomputes the hash from the revealed seed and confirms it matches what was published *before* the draw ran, proving the outcome wasn't tampered with after the fact.

Cron times run in the server's timezone unless `CRON_TIMEZONE` is set (e.g. `Asia/Kolkata`).

## Testing without a live Telegram bot

Telegram login requires a cryptographically signed payload only Telegram can produce. For local development, see the bypass instructions in `requests.http`. **Remove the bypass before deploying.**

## Known operational notes

- **Blockchain flakiness:** the private SCAI network occasionally drops a signed transaction silently rather than erroring. `blockchainService.js` retries mint/transfer calls up to 3 times with backoff (2s/4s/6s) before giving up — see `sendWithRetry`.
- **Fail-safe ordering:** `withdrawalService.js` always sends tokens on-chain *before* touching the database. If the blockchain call fails, no coins are deducted and no withdrawal record is created — money is never debited without a confirmed on-chain transfer.
- **Container restarts on Railway:** a `SIGTERM` in the logs without an accompanying stack trace is a platform-level restart (deploy, memory threshold), not an application crash — check Railway's deployment history/metrics rather than app code.

## Deployment

Deployed on Railway (see repo-root `Procfile`). Set all required env vars in the Railway dashboard; it auto-installs and runs `npm start` from `backend/`.
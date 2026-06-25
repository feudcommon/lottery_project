# SCAI Lucky Loop — Backend

Free-to-play daily lottery backend for a Telegram Mini App with Web3 token withdrawal. Users earn coins, spend them on tickets, a secure server-side draw picks a daily winner, and coins eventually convert to on-chain SCAI tokens once a referral-based unlock condition is met.

This README covers setup. See **`DOCUMENTATION.md`** for a full topic-by-topic explanation of every concept used (REST design, JWT, cron, randomness, validation, rate limiting) — that's the file written specifically to teach the concepts, not just describe the code.

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
- A Telegram bot token from [@BotFather](https://t.me/BotFather) (needed for real login; see `requests.http` for a local bypass while developing)
- No external database server needed — uses SQLite (file-based) via `better-sqlite3`

## Project layout

```
src/
  app.js              Express app assembly (middleware + route mounting)
  server.js           Entry point — starts the HTTP server + cron jobs
  config/             All tunable numbers (ticket price, hours, limits) read from .env
  db/
    init.js           Creates the SQLite schema (run once via `npm run init-db`)
    connection.js      Shared DB connection used everywhere else
  routes/             Express routers — one file per resource, just wiring
  controllers/        Request/response handling — thin, calls into services
  services/           All business logic (ticket purchase, draw, withdrawal, etc.)
  middleware/         auth, validation, rate limiting, error handling
  jobs/                node-cron schedule that runs the lottery automatically
  utils/               JWT signing/verification, Telegram signature verification
```

Why this split: routes only wire HTTP methods to controllers. Controllers only parse requests and format responses. Services hold all the actual rules (ticket limits, coin math, draw fairness). That separation means you can unit-test `services/` without ever touching Express, and swap SQLite for Postgres later by only touching `db/` and the SQL inside `services/`.

## Environment variables

See `.env.example` for the full list with comments. The ones you must set before running:

- `JWT_SECRET` — any long random string; the server refuses to start without it
- `TELEGRAM_BOT_TOKEN` — required for real Telegram login verification to work
- `ADMIN_TELEGRAM_IDS` — comma-separated Telegram user IDs allowed to hit `/api/admin/*`

Everything else (ticket price, sales hours, withdrawal thresholds) has working defaults matching the original spec (50 tickets/day, 2/user, 10 coins each, sales 09:00–15:00, draw at 18:00, 1000 coins + 5 referrals to unlock withdrawal).

## API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/telegram` | none | Exchange Telegram login data for a JWT |
| GET | `/api/user/me` | user | Your full profile |
| GET | `/api/user/:id/coins` | user | Your coin balance (id must be your own) |
| GET | `/api/user/me/history` | user | Your coin transaction ledger |
| POST | `/api/spin` | user | Claim a free daily coin reward |
| GET | `/api/tickets/today` | user | See today's availability + your tickets |
| POST | `/api/buy-ticket` | user | Buy a lottery ticket (10 coins) |
| POST | `/api/withdraw` | user | Request a coin → token withdrawal |
| GET | `/api/withdraw/eligibility` | user | Check if withdrawal is unlocked yet |
| GET | `/api/withdraw/history` | user | Your past withdrawal requests |
| GET | `/api/draws/:date` | none | Public result for a given day |
| GET | `/api/draws/:date/verify` | none | Anyone can verify a draw was fair |
| GET/POST | `/api/admin/*` | admin | User list, ticket sales, withdrawal approval, manual draw trigger |

Full example requests (with comments on auth flow and a local-dev bypass) are in `requests.http`.

## Testing without a live Telegram bot

Telegram login requires a cryptographically signed payload that only Telegram itself can produce — you can't fake it without the real bot token. For local development before you've wired up the actual Telegram Mini App frontend, see the bypass instructions in `requests.http`. Remove it before deploying.

## What's stubbed vs. fully implemented

Fully implemented and tested (logic verified with standalone simulations, see chat history): ticket purchase concurrency safety, commit-reveal random draw, Telegram HMAC signature verification, JWT issuance/verification, all validation schemas, rate limiting, cron scheduling.

Intentionally stubbed (needs your own setup to go live): `src/services/blockchainService.js` — the actual on-chain token transfer. It's left as a clearly-marked stub because it requires a deployed ERC-20 contract and a funded backend wallet, which only you can provide. The withdrawal flow around it (eligibility checks, pending/sent/rejected states, coin deduction) is fully implemented; only the final "make the chain transaction" call needs `ethers.js` wired in once you have a contract address and RPC URL.

## Important: this was not run against a live server in this session

This code was written and logic-tested (syntax-checked across all files, plus standalone simulations of the randomness, concurrency, and auth-signing algorithms — see the chat for results) in a sandboxed environment without internet access, so `npm install` and a real end-to-end boot of the Express server could not be performed here. Before deploying, run it yourself locally end-to-end (`npm install && npm run init-db && npm run dev`, then exercise `requests.http`) to catch anything that only surfaces once everything is actually wired together live.

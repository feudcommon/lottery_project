SCAI Lucky Loop — Architecture Documentation

1. Overview

SCAI Lucky Loop is a free-to-play daily lottery Telegram Mini App. Users log in  
via Telegram, earn coins through a daily "spin," spend coins on lottery  
tickets, and a server-side commit-reveal draw picks a winner each day. Coins  
can eventually be withdrawn as on-chain LLT (Lucky Loop Token, ERC-20)  
once a user clears a referral-based unlock threshold.

┌─────────────────────────────────────────────┐
│         TELEGRAM MINI APP                    │
│      (React + TypeScript Frontend)           │
└────────────────┬──────────────────────────────┘
                  │ HTTPS (Bearer JWT)
┌─────────────────▼──────────────────────────────┐
│     EXPRESS.JS BACKEND (Node.js)                │
│   - SQLite Database (better-sqlite3)            │
│   - JWT Auth + Telegram signature verification  │
│   - Rate limiting (per-endpoint)                │
│   - Cron jobs (sales close, draw, housekeeping) │
└────────────────┬──────────────────────────────┘
                  │
         ┌────────┴─────────┐
         │                  │
         ▼                  ▼
     SQLite DB         Blockchain RPC (ethers.js)
   (source of truth)   LLT Token Contract (ERC-20)

Three deployable units live in one repo:

| Directory | Purpose | Deploy target |
| --- | --- | --- |
| backend/ | Express API, SQLite, cron jobs, blockchain calls | Railway (Procfile) |
| frontend/ | React + TypeScript Telegram Mini App UI | Vercel (vercel.json) |
| contracts/ | Solidity LuckyLoopToken ERC-20 + Hardhat 3 tests | SCAI Private Network (Chain ID 34) |

---

2. Backend Layering

The backend follows a strict routes → controllers → services → db  
pipeline. This separation exists so business rules can be unit-tested without  
touching Express, and so SQLite can eventually be swapped for Postgres by only  
touching db/ and the SQL inside services/.

HTTP Request
    │
    ▼
Middleware stack (helmet → cors → json body parser → global rate limiter)
    │
    ▼
Route-specific middleware (requireAuth → per-route rate limiter → validate(schema))
    │
    ▼
Controller  — parses req, calls a service, shapes the JSON response
    │
    ▼
Service     — all business rules (limits, coin math, draw fairness) live here
    │
    ▼
db/connection.js — a single shared better-sqlite3 handle

Routes never contain logic beyond wiring an HTTP verb + path to a controller.  
Controllers never touch SQL directly — that's the service layer's job.

2.1 Middleware order (from app.js)

js
app.use(helmet());                 // security headers
app.use(cors());                   // Telegram Mini App origin
app.use(express.json({ limit: "100kb" }));
app.use(globalLimiter);            // 60 req/min/IP safety net
// ...route mounting...
app.use(notFoundHandler);
app.use(errorHandler);             // MUST be last

Order matters: requireAuth populates req.user, and anything depending on  
req.user (e.g. requireAdmin) must be stacked after it.

2.2 Centralized error handling

Every route handler is wrapped in asyncHandler, which forwards any thrown  
error (or rejected promise) to Express's next(). A single errorHandler  
registered last in app.js turns any AppError into a clean JSON response  
and swallows/logs anything unexpected rather than leaking a stack trace to  
the client.

js
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

This pattern is also what prevents a very real production bug: an  
un-awaited async call inside a controller. If a service function is  
async and the caller forgets await, an exception thrown inside it becomes  
an unhandled promise rejection, which crashes the whole Node process rather  
than being caught by asyncHandler. See the companion blog post  
blog/the-missing-await-bug.md for a real incident write-up.

---

3. Authentication

Two independent trust chains stack on top of each other:

1.  Telegram → Backend (one-time, per login).  
    Telegram signs a initData payload using the bot token as an HMAC key.  
    utils/telegramAuth.js recomputes that HMAC using the same bot token and  
    compares it to the hash field Telegram sent. Because only Telegram and  
    the backend know the bot token, this proves the login genuinely came from  
    Telegram and wasn't spoofed. A replay window (MAXAGESECONDS = 24h)  
    rejects stale payloads.
    
2.  Backend → Client (every subsequent request).  
    Once Telegram login is verified, the backend issues its own JWT  
    (utils/jwt.js), signed with JWTSECRET. The client attaches this as  
    Authorization: Bearer <token> on every future call. middleware/auth.js  
    verifies the signature and then re-fetches the user row from the  
    database on every request rather than trusting the token's cached  
    claims — this means a ban takes effect immediately, not only after the  
    token expires.
    

js
function requireAuth(req, res, next) {
  // ...verify JWT signature...
  const user = db.prepare("SELECT  FROM users WHERE id = ?").get(payload.sub);
  if (!user) return res.status(401).json({ error: "User no longer exists" });
  if (user.isbanned) return res.status(403).json({ error: "Account suspended" });
  req.user = user;
  next();
}

requireAdmin stacks after requireAuth and checks req.user.telegramid  
against the ADMINTELEGRAMIDS env var.

---

4. The Lottery Lifecycle

Everything below is orchestrated by jobs/lotteryCron.js, driven by three  
node-cron schedules (CRONTIMEZONE controls what timezone "15:00" etc.  
mean — critical for a global user base).

09:00–15:00  Sales window open   → users buy tickets (isSalesOpen())
15:00        closeSalesAndCommitSeed(today)
             - generates 32 random bytes (crypto.randomBytes — NOT Math.random)
             - publishes sha256(seed) immediately, keeps seed secret
             - draw row transitions: open → closed
18:00        runDraw(today)
             - deterministically picks the winner from the committed seed
             - credits winner, records the transaction
             - REVEALS the seed publicly
             - draw row transitions: closed → drawn
00:01        housekeeping — pre-creates tomorrow's empty draw row

4.1 Commit-reveal fairness

The core trick: the randomness source is locked in (as a hash) before  
anyone — including the operator — could know who it will pick. This is  
what makes the draw independently auditable rather than merely "we promise  
we didn't cheat."

js
function seedToIndex(seed, max) {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % max;
}

GET /api/draws/:date/verify is a public, unauthenticated endpoint —  
deliberately so, since the whole point of commit-reveal is that anyone, not  
just admins, can recompute sha256(revealedseed) and check it matches the  
hash that was published hours earlier, and recompute the winning index from  
the same seed to check it matches the recorded winner.

4.2 Handling the zero-ticket edge case

If nobody buys a ticket on a given day, no draws row exists (since  
buyTicketTransaction is otherwise the only path that creates one).  
closeSalesAndCommitSeed now defensively creates an empty draws row before  
proceeding, so a quiet day still closes and draws cleanly (runDraw already  
handled tickets.length === 0 by marking the draw drawn with a null  
winner — the bug was that it never got the chance to run at all).

---

5. Concurrency Safety

Ticket purchases are the most abuse-sensitive write path in the system: two  
simultaneous requests for the same day must never both succeed if only one  
slot / coin balance allows it. services/ticketService.js wraps the entire  
purchase in a single better-sqlite3 transaction:

js
const buyTicketTransaction = db.transaction((userId, drawDate, desiredSlotNumber) => {
  // 1. re-read user + draw state fresh, inside the transaction
  // 2. check: sales window open, per-user daily limit, coin balance,
  //           global daily ticket cap, slot not already sold
  // 3. only if every check passes: deduct coins, insert ticket, log transaction
});

better-sqlite3 is synchronous, which is a deliberate choice here: there's  
no await between "read balance" and "write balance," so there's no window  
for a second request to interleave and cause a double-spend — a real  
advantage over async database drivers for this specific workload.

A dedicated spinLimiter (3 requests/minute) and buyTicketLimiter  
(5/minute) sit in front of these routes as a second, independent layer of  
defense — even if the transaction logic had a bug, the rate limiter caps the  
blast radius.

---

6. Withdrawals & the Blockchain Boundary

services/withdrawalService.js enforces, in order: valid wallet address  
format, positive amount, account not banned, eligibility (minCoins +  
minReferrals, both configurable via env and returned to the frontend so the  
UI never hardcodes them), sufficient balance, and a minimum withdrawal size.

Critically, the on-chain transfer happens before any database mutation:

js
const blockchainResult = await sendTokensOnChain(walletAddress, tokenAmount);
if (!blockchainResult.success) {
  throw new AppError(Blockchain error: ${blockchainResult.error}. Your coins have NOT been deducted., 500);
}
// only now: deduct coins + insert withdrawal row, inside one db.transaction()

This ordering means a failed blockchain call can never silently burn a  
user's coins. The inverse risk — a successful on-chain transfer that fails to  
record in the DB — is mitigated by keeping the DB write as a tight,  
synchronous, error-free transaction with nothing left to fail after the  
chain call succeeds.

services/blockchainService.js wraps mint/transfer calls in  
sendWithRetry, a 3-attempt exponential backoff (2s/4s/6s), to ride out  
transient RPC flakiness on the private chain (see the companion blog post on  
this exact incident).

---

7. Rate Limiting Strategy

Different endpoints get different limits based on abuse sensitivity:

| Limiter | Window | Max | Rationale |
| --- | --- | --- | --- |
| globalLimiter | 1 min | 60/IP | general safety net |
| loginLimiter | 1 min | 10/IP | brute-force resistance |
| buyTicketLimiter | 1 min | 5/IP | generous for a real user, blocks scripted spam |
| spinLimiter | 1 min | 3/IP | this is the literal free-coin faucet — tightest limit |
| withdrawLimiter | 1 hour | 5/IP | money-moving endpoint |

All limiters currently store counters in-memory. The moment more than one  
backend process runs behind a load balancer, this needs to move to a  
Redis-backed store (rate-limit-redis) — otherwise the effective limit  
becomes configured limit × number of processes, silently defeating the  
control.

---

8. Frontend Structure

frontend/src/
  api/client.ts       axios instance; injects Bearer token, redirects to
                       /login on any 401 response
  store/userStore.ts  zustand store, persists user + token to localStorage
  hooks/               one hook per concern (useAuth, useBalance, useTickets,
                       useWithdraw, useDraws) — each owns its own loading/
                       error state and talks to api/client.ts directly
  pages/                one route per screen (Login, Home, Tickets, Draws,
                       Withdraw, Profile)

ProtectedRoute in App.tsx gates every authenticated page behind a  
token check in the zustand store, redirecting to /login otherwise.

api/client.ts centralizes 401 handling: any expired/invalid JWT clears  
localStorage and hard-redirects to /login, so individual hooks don't need  
to duplicate that logic.

---

9. Smart Contract

contracts/contract/LLT.sol — LuckyLoopToken, a standard OpenZeppelin  
ERC20 + ERC20Burnable + Ownable (v4.9.2) with two additions:

-   mint(to, amount) — onlyOwner, used by the backend's payout wallet to  
    mint tokens just-in-time for a withdrawal rather than pre-minting a large  
    supply.
-   batchTransfer(recipients[], amounts[]) — onlyOwner, for bulk payouts  
    in a single transaction; reverts if array lengths mismatch.

The backend's payout flow is mint-then-transfer, not a pre-funded  
treasury: sendTokensOnChain calls contract.mint(signer.address, amount)  
followed by contract.transfer(toAddress, amount). This means the backend  
wallet's private key is the single most sensitive secret in the system — it  
has unilateral minting rights.

---

10. Known Gaps / Follow-ups

-   Rate limiter store is in-memory only; needs Redis before horizontal scaling.
-   blockchainService.js mint-then-transfer is two separate transactions —  
    a crash between them would leave tokens minted to the backend wallet but  
    not yet forwarded to the user (recoverable manually, but not automatic).
-   No idempotency key on POST /api/withdraw — a client retry after a  
    timeout (as opposed to an explicit error) could theoretically double-submit  
    before the first request's DB write lands. Rate limiting on this endpoint  
    (5/hour) is the current mitigation.
-   Admin endpoints (/api/admin/) authenticate via an allow-list of Telegram  
    IDs read from an env var — sufficient at current scale, but doesn't scale  
    to role management.
# SCAI Lucky Loop — Project Documentation

## Overview

SCAI Lucky Loop is a daily, coin-based lottery available as a website and Telegram Mini App. Players authenticate via Telegram or a wallet-only login, earn coins, buy tickets, verify results, and — when eligible — withdraw LLT tokens to a SCAI-compatible wallet.

## Technology and architecture

The client is React, TypeScript, Vite and React Router. The API is Express with a remote Turso (libSQL) database, JWT authentication, rate limiting and scheduled jobs. The token contract is Solidity/Hardhat; wallet connection uses Reown AppKit and ethers. See [architecture.md](./architecture.md) and the diagrams in [Assets](./Assets) for runtime paths, security boundaries and database relationships.

## Player flow

1. Open the website or Telegram Mini App and review the shared Game Rules screen.
2. Sign in through Telegram, or connect a wallet and sign a one-time message to log in without a Telegram account.
3. Claim a daily coin reward or earn referral rewards. Top up coins directly, if desired, by sending on-chain SCAI to a treasury address or paying via Stripe Checkout.
4. Open Tickets, select an available slot and spend 10 coins. A zero coin balance cannot purchase a ticket; the player is directed to earn or buy coins first.
5. After sales close, the scheduled job reveals its pre-committed seed and selects a winning ticket.
6. Winning rewards are credited to the player's in-app coin balance and appear in transaction history.
7. An eligible player provides a SCAI-compatible wallet address and submits a withdrawal request. The backend validates it, sends LLT on-chain when configured, and returns a transaction hash.

## Lottery and fairness

Ticket sales, per-user limits, balances and slot availability are checked atomically by the backend. The draw uses a commit-reveal model: the hash of a secret seed is published before the draw, then the seed is revealed after sales close. Anyone can call `GET /api/draws/:date/verify` to validate the result — no login required, by design. A weekly jackpot pool uses the same commit-reveal pattern, verifiable via `GET /api/jackpot/:weekStart/verify`. The daily scheduler is implemented in `backend/src/jobs/lotteryCron.js`.

## Coin, rewards, deposits and withdrawals

Coins are in-app units used for tickets. The free daily spin and referral rewards add coins; ticket purchases and withdrawals deduct them. Coins can also be purchased directly two ways: sending native SCAI on-chain to a treasury address (verified against the chain before crediting, see `/api/deposit/*`), or Stripe Checkout for fiat (`/api/stripe/*`). A draw winner receives a coin reward. Withdrawal eligibility uses the configured coin and referral thresholds. An admin approves pending withdrawal requests, which triggers the blockchain service; an unsuccessful chain operation does not deduct coins. The deployed LLT contract address and SCAI network configuration are documented in the root README.

## Administration

The protected `/admin` screen is backed by admin endpoints under `/api/admin/*`, gated by `requireAuth` plus `requireAdmin`. Admin status comes from any of three sources: a Telegram ID in `ADMIN_TELEGRAM_IDS`, a wallet address in `ADMIN_WALLET_ADDRESSES`, or the `is_admin` column in the database. The first two are bootstrap-only (env vars, need a redeploy to change); the third can be granted or revoked by an existing admin directly in the panel, with no redeploy. The panel supports user review and admin promotion/demotion, ticket-sales inspection, pending withdrawal approval/rejection, manual draw execution, and jackpot close/draw actions. Endpoint details, request bodies and response examples are in [Api.md](./Api.md).

## API and database

`Api.md` is the canonical REST API reference. Turso/libSQL tables are created in `backend/src/db/init.js`; the ERD is [Assets/db_erd.drawio.png](./Assets/db_erd.drawio.png). Core tables include users (nullable `telegram_id`, since wallet-only accounts exist), tickets, draws, coin transactions, withdrawals, deposits, and jackpot records.

## Deployment and verification

Deploy `frontend/` to Vercel and `backend/` to Render. The root README lists required environment variables, build commands, SCAI RPC/contract settings and security cautions. Before production, set Telegram bot credentials, admin allowlists (Telegram ID and/or wallet), a secure JWT secret, RPC configuration, Stripe keys if fiat deposits are enabled, and a funded backend wallet with the required LLT permissions.

- Website and Telegram Mini App share the React app and the `/rules` content (served by `GameRules.tsx`).
- Ticket buying, zero-balance handling, balances, history, draws, deposits and withdrawals are implemented by authenticated API routes.
- Admin management functions are present in `/api/admin/*` and documented, including in-app admin promotion.
- On-chain payout and on-chain deposit verification both require valid live RPC, contract and private-key configuration; neither can be verified without deployment secrets.
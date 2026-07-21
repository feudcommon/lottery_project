# SCAI Lucky Loop â€” Project Documentation

## Overview

SCAI Lucky Loop is a daily, coin-based lottery available as a website and Telegram Mini App. Players authenticate with Telegram, earn coins, buy tickets, verify results, andâ€”when eligibleâ€”withdraw LLT tokens to a SCAI-compatible wallet.

## Technology and architecture

The client is React, TypeScript, Vite and React Router. The API is Express with SQLite, JWT authentication, rate limiting and scheduled jobs. The token contract is Solidity/Hardhat; wallet connection uses Reown AppKit and ethers. See [architecture.md](./architecture.md) and the diagrams in [Assets](./Assets) for runtime paths, security boundaries and database relationships.

## Player flow

1. Open the website or Telegram Mini App and review the shared Game Rules screen.
2. Sign in through Telegram and claim a daily coin reward or earn referral rewards.
3. Open Tickets, select an available slot and spend 10 coins. A zero coin balance cannot purchase a ticket; the player is directed to earn coins first.
4. After sales close, the scheduled job reveals its pre-committed seed and selects a winning ticket.
5. Winning rewards are credited to the playerâ€™s in-app coin balance and appear in transaction history.
6. An eligible player provides a SCAI-compatible wallet address and submits a withdrawal request. The backend validates it, sends LLT on-chain when configured, and returns a transaction hash.

## Lottery and fairness

Ticket sales, per-user limits, balances and slot availability are checked atomically by the backend. The draw uses a commit-reveal model: the hash of a secret seed is published before the draw, then the seed is revealed after sales close. Anyone can call `GET /api/draws/:date/verify` to validate the result. The daily scheduler is implemented in `backend/src/jobs/lotteryCron.js`.

## Coin, rewards and withdrawals

Coins are in-app units used for tickets. The free daily spin and referral rewards add coins; ticket purchases and withdrawals deduct them. A draw winner receives a coin reward. Withdrawal eligibility uses the configured coin and referral thresholds. The admin approves pending withdrawal requests, which triggers the blockchain service; an unsuccessful chain operation does not deduct coins. The deployed LLT contract address and SCAI network configuration are documented in the root README.

## Administration

The protected `/admin` screen is backed by admin endpoints that require a JWT plus a Telegram ID listed in `ADMIN_TELEGRAM_IDS`. It supports user review, ticket-sales inspection, pending withdrawal approval/rejection, and manual draw execution; the API also exposes jackpot close/draw actions. Endpoint details, request bodies and response examples are in [Api.md](./Api.md).

## API and database

`Api.md` is the canonical REST API reference. SQLite tables are created in `backend/src/db/init.js`; the ERD is [Assets/db_erd.drawio.png](./Assets/db_erd.drawio.png). Core tables include users, tickets, draws, coin transactions, withdrawals and jackpot records.

## Deployment and verification

Deploy `frontend/` to Vercel and `backend/` to Railway. The root README lists required environment variables, build commands, SCAI RPC/contract settings and security cautions. Before production, set Telegram bot credentials, an allowlist of admin Telegram IDs, a secure JWT secret, RPC configuration and a funded backend wallet with the required LLT permissions.

- Website and Telegram Mini App share the React app and the `/rules` content.
- Ticket buying, zero-balance handling, balances, history, draws and withdrawals are implemented by authenticated API routes.
- Admin management functions are present in `/api/admin/*` and documented.
- On-chain payout requires valid live RPC, contract and private-key configuration; it cannot be verified without deployment secrets.



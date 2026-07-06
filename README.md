# SCAI Lucky Loop

A free-to-play daily lottery Telegram Mini App where users earn coins through daily spins, buy tickets, participate in verifiable random draws, and withdraw LLT tokens.

Live Demo: [@ScaiLuckyLoop_bot](https://t.me/ScaiLuckyLoop_bot)

---

## Features

### User Features
- Daily Spin Rewards - Claim free coins every 24 hours
- Ticket System - Buy up to 2 tickets per day (10 coins each)
- Verifiable Draws - Fair, randomness-assured daily lottery at 11 PM UTC
- Coin Economy - Earn coins, manage balance, track transactions
- Referral Bonuses - Invite friends for +100 coin bonus when 5+ referrals active
- Withdrawal System - Cash out to LLT tokens (500 coins minimum)
- Results Page - View draw history and winner announcements
- Dark UI - Beautiful purple gradient Telegram Mini App interface

### Technical Features
- Race-Condition Safe - SQLite transactions prevent coin duplication exploits
- Commit-Reveal Fairness - Publicly verifiable draw using cryptographic seeds
- Web3 Integration - ERC-20 token withdrawals to SCAI Private Network
- JWT Authentication - Telegram sign-in integration
- Rate Limiting - Global and per-endpoint request throttling

---

## Architecture

```
┌─────────────────────────────────────────────┐
│         TELEGRAM MINI APP                   │
│      (React + TypeScript Frontend)          │
└────────────────┬────────────────────────────┘
                 │ HTTPS
┌────────────────▼────────────────────────────┐
│     EXPRESS.JS BACKEND (Node.js)            │
│   - SQLite Database                         │
│   - JWT Auth + Rate Limiting                │
│   - Cron Jobs (sales close, draw at 11 PM) │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴─────────┐
        │                  │
        ▼                  ▼
    SQLite DB         Blockchain RPC
   (Data Store)     (LLT Token Contract)
                    0x290483A8fC8ed76647dA75260eb2a2594B5330a2
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Telegram account

### Installation

```bash
# Clone repository
git clone https://github.com/feudcommon/lottery_project.git
cd lottery_project

# Backend setup
cd backend
npm install
npm start

# Frontend setup (in new terminal)
cd frontend
npm install
npm start
```

### Environment Variables

**backend/.env**
```
PORT=3000
NODE_ENV=production
JWT_SECRET=your_secret_key_here
TELEGRAM_BOT_TOKEN=your_bot_token
DB_PATH=./data/lucky_loop.db

# Game Config
TICKET_PRICE=10
MAX_TICKETS_PER_USER_PER_DAY=2
TOTAL_TICKETS_PER_DAY=50
WINNER_REWARD=100
PLATFORM_FEE=100

# Schedule (IST)
SALES_OPEN_HOUR=0
SALES_CLOSE_HOUR=22
DRAW_HOUR=23
CRON_TIMEZONE=Asia/Kolkata

# Blockchain
RPC_URL=https://mainnet-rpc.scai.network
CHAIN_ID=34
LLT_CONTRACT_ADDRESS=0x290483A8fC8ed76647dA75260eb2a2594B5330a2
BACKEND_PRIVATE_KEY=your_private_key

# Withdrawal
WITHDRAW_MIN_COINS=500
WITHDRAW_MIN_REFERRALS=5
```

**frontend/.env.local**
```
REACT_APP_API_URL=https://your-backend-url.railway.app
REACT_APP_RPC_URL=https://mainnet-rpc.scai.network
REACT_APP_CONTRACT_ADDRESS=0x290483A8fC8ed76647dA75260eb2a2594B5330a2
REACT_APP_CHAIN_ID=34
REACT_APP_EXPLORER_URL=https://explorer.securechain.ai
```

---

## Project Structure

```
lottery_project/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── services/           # Business logic
│   │   ├── routes/             # API endpoints
│   │   ├── middleware/         # Auth, rate limiting
│   │   ├── jobs/               # Cron jobs (draws)
│   │   └── db/                 # Database init & schema
│   └── package.json
│
├── frontend/                   # React TypeScript Mini App
│   ├── src/
│   │   ├── pages/              # Tickets, Draws, Profile, Withdraw
│   │   ├── components/         # Reusable UI elements
│   │   ├── hooks/              # Custom React hooks
│   │   ├── api/                # API client
│   │   └── App.tsx             # Main app
│   └── package.json
│
├── contracts/                  # Solidity ERC-20 Token
│   └── LLT.sol                 # LLT Token Contract
│
├── Procfile                    # Railway deployment config
├── vercel.json                 # Vercel deployment config
└── README.md                   # This file
```

---

## How It Works

### Daily Flow

1. 9 AM IST - User claims daily spin reward (+5-50 coins)
2. 9 AM - 10 PM IST - Buy lottery tickets (10 coins each)
3. 10 PM IST - Automated sales close, seed committed
4. 11 PM IST - Draw runs, winner selected, coins awarded
5. Anytime - Withdraw 500+ coins as LLT tokens

### Referral System

- Share your unique referral code with friends
- When 5+ friends become active players - Unlock +100 coin bonus
- Bonus is optional - you can withdraw at 500 coins anytime

### Fair Randomness

The draw uses commit-reveal to ensure fairness:

1. Commit Phase (10 PM) - Server generates seed & publishes SHA-256 hash
2. Reveal Phase (11 PM) - Actual seed revealed after draw completes
3. Verification - Anyone can verify the seed matches the hash using the `/api/draws/:date/verify` endpoint

---

## API Endpoints

### Auth
- POST /api/auth/telegram - Verify Telegram user

### User
- GET /api/user/info - Get user profile
- GET /api/user/referrals - Get referral count

### Coins
- POST /api/spin - Claim daily reward

### Tickets
- GET /api/tickets/today - Get today's tickets & balance
- POST /api/buy-ticket - Purchase lottery ticket

### Draws
- GET /api/draws/history?days=7 - Get draw history
- GET /api/draws/:date - Get specific draw details
- GET /api/draws/:date/verify - Verify draw fairness

### Withdrawal
- POST /api/withdraw - Request coin withdrawal
- GET /api/withdraw/eligibility - Check withdrawal requirements
- GET /api/withdraw/history - Get withdrawal history

---

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Push to GitHub, Vercel auto-deploys
```

Live URL: [lottery-project-k02qnq47d.vercel.app](https://lottery-project-k02qnq47d.vercel.app)

### Backend (Railway)
```bash
# Set environment variables in Railway dashboard
# Railway auto-detects Procfile and deploys
git push origin main
```

Live URL: [lotteryproject-production.up.railway.app](https://lotteryproject-production.up.railway.app)

### Smart Contract (SCAI Private Network)
Contract Address: `0x290483A8fC8ed76647dA75260eb2a2594B5330a2`

Network: SCAI Private Network (Chain ID: 34)
RPC: `https://mainnet-rpc.scai.network`
Explorer: `https://explorer.securechain.ai`

---

## Security

- Input Validation - Zod schema validation on all endpoints
- Rate Limiting - 100 requests/hour per IP
- JWT Auth - 7-day token expiry
- Transaction Safety - SQLite transactions prevent race conditions
- CORS Protected - Restricted to Telegram Mini App origin
- Helmet.js - HTTP security headers enabled

---

## Troubleshooting

### Draw Not Running?
- Check Railway logs for [CRON] running draw
- Verify SALES_CLOSE_HOUR < DRAW_HOUR
- Ensure CRON_TIMEZONE=Asia/Kolkata

### Tickets Not Showing?
- Hard refresh (Ctrl+Shift+R)
- Check Network tab for /api/tickets/today response
- Verify slotNumber is being sent in POST payload

### Frontend Won't Load?
- Verify REACT_APP_API_URL points to correct backend
- Check browser console for CORS errors
- Ensure backend is running and accessible

---

## Technology Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Express.js, Node.js, SQLite |
| Database | SQLite (better-sqlite3) |
| Auth | JWT, Telegram Mini App Sign-in |
| Blockchain | Solidity (ERC-20), ethers.js |
| Deployment | Vercel (frontend), Railway (backend) |
| Network | SCAI Private Network |

---

## Documentation

- Backend Setup Guide: ./backend/README.md
- Frontend Setup Guide: ./frontend/README.md
- Smart Contract Details: ./contracts/README.md

---

## License

This project is open source. See LICENSE file for details.

---

# SCAI Lucky Loop — Frontend

React + TypeScript Telegram Mini App for SCAI Lucky Loop — the client users interact with inside Telegram to spin for coins, buy lottery tickets, watch draws resolve, and withdraw LLT tokens.

## Quick start

```bash
npm install
npm start
```

Runs the dev server at [http://localhost:3000](http://localhost:3000) with hot reload. By default it talks to a backend at `http://localhost:3000` too — if you're running the backend locally, either change the backend's `PORT` or set `REACT_APP_API_URL` (see below) so the two don't collide.

## Environment variables

Create `frontend/.env.local` for local development:

```
REACT_APP_API_URL=http://localhost:3001   # wherever your backend is running
```

Production build uses `.env.production` (checked in with the deployed backend URL).

## Project layout

```
src/
  App.tsx                Route table + Telegram WebApp init (tg.ready()/tg.expand())
  pages/                  One component per screen
    Login.tsx             Telegram sign-in entry point
    Home.tsx               Balance card, daily spin, nav grid
    Tickets.tsx             50-slot ticket grid for today's draw
    Draws.tsx               Draw history + commit-reveal verification UI
    Withdraw.tsx             Eligibility check + withdrawal request form
    Profile.tsx              User info, referral link, logout
  hooks/                  Data-fetching hooks, one per concern
    useAuth.ts              Telegram login flow
    useBalance.ts            Polls /api/user/me for live coin balance
    useTickets.ts / useWithdraw.ts / useDraws.ts
  store/
    userStore.ts            Zustand store — user object + JWT, persisted to localStorage
  api/
    client.ts                Axios instance: attaches JWT header, redirects to /login on 401
  components/               Small reusable UI pieces (BalanceCard, Header, Loading, DrawCountdown)
```

## Auth flow

1. `useAuth.loginWithTelegram()` reads `window.Telegram.WebApp.initData` (only available when actually opened inside Telegram).
2. Posts it to `POST /api/auth/telegram`.
3. Backend verifies the Telegram signature and returns a JWT + user profile.
4. `userStore` persists both to `localStorage`; `api/client.ts` attaches the JWT to every subsequent request automatically.
5. `ProtectedRoute` in `App.tsx` redirects to `/login` if there's no token; `client.ts`'s response interceptor does the same on any `401`.

## Available scripts

### `npm start`
Development mode with hot reload; lint errors show in the console.

### `npm test`
Launches the CRA test runner in interactive watch mode.

### `npm run build`
Production build to `build/` — minified, hashed filenames, ready to deploy.

### `npm run eject`
One-way CRA config eject. Not used in this project — avoid unless you specifically need to hand-edit the webpack/Babel/ESLint config.

## Styling

Screens use inline styles directly (dark purple/magenta gradient theme) rather than Tailwind utility classes in most pages, though Tailwind is configured (`tailwind.config.js`, `postcss.config.js`) and available via `index.css`'s `@tailwind` directives for any new components.

## Deployment

Deployed on Vercel — see repo-root `vercel.json` (build command `cd frontend && npm install && npm run build`, output `frontend/build`, with headers set to allow embedding inside `web.telegram.org` / `t.me` via CSP `frame-ancestors`). Push to the connected branch and Vercel auto-builds.

Make sure `REACT_APP_API_URL` in `.env.production` points at the live backend before deploying.

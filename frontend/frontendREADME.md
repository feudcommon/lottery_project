# SCAI Lucky Loop frontend

The frontend is a Vite + React + TypeScript app that works both as a Telegram Mini App and as a standalone browser SPA. It provides the lottery interface, two login paths (Telegram and wallet-only), authenticated API access, coin top-up flows, and the SCAI wallet connection used for withdrawals and admin access.

## Commands

```bash
npm install
npm run dev       # local Vite server
npm run build     # production output in dist/
npm run preview   # preview a production build
```

Vite normally serves the app at `http://localhost:5173`.

## Environment variables

Create `.env.local` for development:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_TELEGRAM_BOT_USERNAME=YourBotUsername_bot
VITE_RPC_URL=https://mainnet-rpc.scai.network
VITE_CONTRACT_ADDRESS=0x290483A8fC8ed76647dA75260eb2a2594B5330a2
VITE_CHAIN_ID=34
VITE_EXPLORER_URL=https://explorer.securechain.ai
VITE_REOWN_PROJECT_ID=your_reown_project_id
```

The Telegram login widget requires your bot username and the current domain to be authorized in BotFather. If this value is missing, the Telegram login button will not render — the wallet-only login path still works without it.
Vite only exposes variables beginning with `VITE_`. Do not use legacy `REACT_APP_*` names.

`VITE_REOWN_PROJECT_ID` enables Reown AppKit, which backs both wallet login and wallet connection for withdrawals. If it is absent, the app still loads and the wallet-dependent sections report that wallet connection is unavailable.

## Code layout

```text
src/
  appkit.tsx                 SCAI Mainnet AppKit configuration
  App.tsx                    BrowserRouter and protected routes (incl. /admin)
  api/client.ts              Axios client and JWT request/401 handling
  components/WalletConnect.tsx
                             Wallet modal and SCAI network switching
  components/TelegramLoginWidget.tsx
                             Telegram Login Widget, guarded for Mini App vs. browser context
  hooks/                     Feature-level API hooks: useAuth, useWalletAuth, useDeposit,
                             useTickets, useDraws, useBalance, useWithdraw
  pages/                     Login, home, tickets, draws, withdrawal, profile,
                             leaderboard, jackpot, and the admin control panel
  store/userStore.ts         Zustand user and JWT persistence
```

**Housekeeping note:** `src/pages/Landing.tsx` and `src/pages/Rules.tsx` currently exist but are not registered in `App.tsx` — `GameRules.tsx` is the page actually mounted at `/rules`. There's also a stray, incomplete `Contact.tsx` at the repository root (outside `src/pages/`) that isn't imported anywhere; the real page is `src/pages/Contact.tsx`. Worth cleaning these up so the file tree matches what's actually routed.

## Routes and authentication

`/login` is public. Public info pages (`/about`, `/how-it-works`, `/rules`, `/faq`, `/contact`) don't require a session. Every other route — including `/home`, `/tickets`, `/draws`, `/withdraw`, `/profile`, `/leaderboard`, `/jackpot`, and `/admin` — redirects to `/login` when no JWT exists in local storage.

Two ways to obtain that JWT:
- **Telegram**: the Mini App's signed `initData` (or, in a browser tab, the Telegram Login Widget payload) is posted to the backend, which responds with a JWT and user profile.
- **Wallet-only**: connect a wallet via AppKit, request a nonce, sign it, and post the signature — no Telegram account required. See `hooks/useWalletAuth.ts`.

`/admin` is protected the same way as any other authenticated route on the frontend (valid JWT required); the actual admin authorization check happens server-side via `requireAdmin` on every `/api/admin/*` call, not client-side. A page component existing under `src/pages/` does nothing on its own — it only becomes reachable once it's registered as a `<Route>` in `App.tsx`; forgetting that step renders a blank page with no error, since React Router simply has nothing to match.

On a `401`, the API client clears saved auth state and returns to `/login`.

## SCAI wallet behavior

AppKit uses the Ethers adapter for EVM wallets. The configured network is **SCAI Mainnet**:

- Chain ID: `34`
- Native currency: `SCAI`
- RPC: `https://mainnet-rpc.scai.network`
- Explorer: `https://explorer.securechain.ai`

After wallet connection, the client requests a switch to SCAI Mainnet. The user must approve the wallet prompt. The connected wallet can be used to log in directly (wallet-only auth), to supply a withdrawal recipient address, or to send a native-SCAI on-chain deposit toward the coin balance. Ticket purchases themselves remain in-app coin transactions.

## Deployment

Vercel builds this directory with `npm run build` and publishes `dist/`. Configure all `VITE_*` variables in Vercel for Production and Preview, then redeploy because Vite embeds those values at build time. `VITE_API_URL` should point at the Render-hosted backend's public URL.

The repository-level `vercel.json` includes an SPA rewrite so routes such as `/login`, `/withdraw`, and `/admin` work on refresh and browser Back navigation.
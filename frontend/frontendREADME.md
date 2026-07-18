# SCAI Lucky Loop frontend

The frontend is a Vite + React + TypeScript Telegram Mini App. It provides the lottery interface, Telegram login flow, authenticated API access, and the optional SCAI wallet connection used when withdrawing LLT tokens.

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
VITE_RPC_URL=https://mainnet-rpc.scai.network
VITE_CONTRACT_ADDRESS=0x290483A8fC8ed76647dA75260eb2a2594B5330a2
VITE_CHAIN_ID=34
VITE_EXPLORER_URL=https://explorer.securechain.ai
VITE_REOWN_PROJECT_ID=your_reown_project_id
```

Vite only exposes variables beginning with `VITE_`. Do not use legacy `REACT_APP_*` names.

`VITE_REOWN_PROJECT_ID` enables Reown AppKit. If it is absent, the app still loads and the wallet section reports that wallet connection is unavailable.

## Code layout

```text
src/
  appkit.tsx                 SCAI Mainnet AppKit configuration
  App.tsx                    BrowserRouter and protected routes
  api/client.ts              Axios client and JWT request/401 handling
  components/WalletConnect.tsx
                             Wallet modal and SCAI network switching
  hooks/                     Feature-level API hooks
  pages/                     Login, home, tickets, draws, withdrawal, profile
  store/userStore.ts         Zustand user and JWT persistence
```

## Routes and authentication

`/login` is public. The application redirects other routes to `/login` when no JWT exists in local storage. Telegram login posts the Mini App's signed `initData` to the backend, which responds with a JWT and user profile.

On a `401`, the API client clears saved auth state and returns to `/login`.

## SCAI wallet behavior

AppKit uses the Ethers adapter for EVM wallets. The configured network is **SCAI Mainnet**:

- Chain ID: `34`
- Native currency: `SCAI`
- RPC: `https://mainnet-rpc.scai.network`
- Explorer: `https://explorer.securechain.ai`

After wallet connection, the client requests a switch to SCAI Mainnet. The user must approve the wallet prompt. Wallet connection supplies a withdrawal recipient address; ticket purchases remain in-app coin transactions.

## Deployment

Vercel builds this directory with `npm run build` and publishes `dist/`. Configure all `VITE_*` variables in Vercel for Production and Preview, then redeploy because Vite embeds those values at build time.

The repository-level `vercel.json` includes an SPA rewrite so routes such as `/login` and `/withdraw` work on refresh and browser Back navigation.

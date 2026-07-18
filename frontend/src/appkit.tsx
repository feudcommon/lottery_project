import React from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';

const projectId = process.env.REACT_APP_REOWN_PROJECT_ID!;
if (!projectId) {
  throw new Error('Missing REACT_APP_REOWN_PROJECT_ID');
}

const scai = defineChain({
  id: 34,
  name: 'SCAI Mainnet',
  nativeCurrency: {
    name: 'SCAI',
    symbol: 'SCAI',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet-rpc.scai.network'],
    },
  },
});

const metadata = {
  name: 'SCAI Lucky Loop',
  description: 'SCAI Lucky Loop wallet connection',
  url: 'https://your-real-domain.com', // Must match your Reown Dashboard domain
  icons: ['https://your-real-domain.com/logo192.png'],
};

const networks = [scai];
const wagmiAdapter = new WagmiAdapter({ networks, projectId });
const queryClient = new QueryClient();

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
  },
});

export function AppKitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
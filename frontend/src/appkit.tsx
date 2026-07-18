import { createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from 'viem';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;
export const isWalletConnectionAvailable = Boolean(projectId);

const scai = defineChain({
  id: Number(import.meta.env.VITE_CHAIN_ID || '34'),
  name: 'SCAI Mainnet',
  nativeCurrency: {
    name: 'SCAI',
    symbol: 'SCAI',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        import.meta.env.VITE_RPC_URL ||
          'https://mainnet-rpc.scai.network',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'SCAI Explorer',
      url:
        import.meta.env.VITE_EXPLORER_URL ||
        'https://explorer.securechain.ai',
    },
  },
});

if (projectId) {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [scai],
    projectId,
    metadata: {
      name: 'SCAI Lucky Loop',
      description: 'SCAI Lucky Loop wallet connection',
      url: 'https://your-vercel-domain.vercel.app',
      icons: ['https://your-vercel-domain.vercel.app/logo192.png'],
    },
    features: {
      analytics: false,
    },
  });
} else {
  console.warn(
    'Wallet connection is disabled: VITE_REOWN_PROJECT_ID is not configured.'
  );
}

import { useEffect } from 'react';
import {
  AppKitButton,
  useAppKitAccount,
  useAppKitNetwork,
} from '@reown/appkit/react';
import { isWalletConnectionAvailable, scai } from '../appkit';

type WalletConnectProps = {
  onAddress: (address: string) => void;
};

export default function WalletConnect({
  onAddress,
}: WalletConnectProps) {
  if (!isWalletConnectionAvailable) {
    return (
      <p role="alert" style={{ color: '#fca5a5', fontSize: '12px', margin: 0 }}>
        Wallet connection is temporarily unavailable. Please configure
        VITE_REOWN_PROJECT_ID and redeploy.
      </p>
    );
  }

  const { address } = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();

  useEffect(() => {
    if (address) onAddress(address);
  }, [address, onAddress]);

  useEffect(() => {
    if (!address || Number(chainId) === scai.id) return;

    switchNetwork(scai).catch((error) => {
      console.error('Unable to switch wallet to SCAI Mainnet:', error);
    });
  }, [address, chainId, switchNetwork]);

  return <AppKitButton />;
}

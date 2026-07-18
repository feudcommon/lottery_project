import { useEffect } from 'react';
import { AppKitButton, useAppKitAccount } from '@reown/appkit/react';
import { isWalletConnectionAvailable } from '../appkit';

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

  useEffect(() => {
    if (address) onAddress(address);
  }, [address, onAddress]);

  return <AppKitButton />;
}

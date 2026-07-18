import { useEffect } from 'react';
import { AppKitButton, useAppKitAccount } from '@reown/appkit/react';

type WalletConnectProps = {
  onAddress: (address: string) => void;
};

export default function WalletConnect({
  onAddress,
}: WalletConnectProps) {
  const { address } = useAppKitAccount();

  useEffect(() => {
    if (address) onAddress(address);
  }, [address, onAddress]);

  return <AppKitButton />;
}
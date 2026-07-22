import { useCallback, useState } from 'react';
import { BrowserProvider, type Eip1193Provider } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import api from '../api/client';
import { useUserStore } from '../store/userStore';

/**
 * Wallet-based auth: "connect wallet and play" with no Telegram involved.
 *
 * The wallet only ever signs a message (see backend/src/utils/walletAuth.js)
 * - never a transaction, no gas, nothing on-chain. That signature is what
 * proves the person controls the address, the same way Telegram's HMAC
 * signature proves a login came from Telegram.
 */
export function useWalletAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser, setToken } = useUserStore();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>('eip155');

  const signNonce = useCallback(
    async (walletAddress: string) => {
      const { data } = await api.get('/api/auth/wallet/nonce', {
        params: { address: walletAddress },
      });
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(data.message);
      return signature;
    },
    [walletProvider]
  );

  /** Signs the connected wallet in, creating a wallet-only account if none exists yet. */
  const loginWithWallet = useCallback(async () => {
    if (!address || !walletProvider) {
      setError('Connect a wallet first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const signature = await signNonce(address);
      const { data } = await api.post('/api/auth/wallet', { address, signature });
      setToken(data.token);
      setUser(data.user);
      window.location.href = '/home';
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Wallet login failed');
    } finally {
      setIsLoading(false);
    }
  }, [address, walletProvider, signNonce, setToken, setUser]);

  /** Attaches the connected wallet to the CURRENT (already logged-in) account. */
  const linkWallet = useCallback(async () => {
    if (!address || !walletProvider) {
      setError('Connect a wallet first.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const signature = await signNonce(address);
      const { data } = await api.post('/api/auth/wallet/link', { address, signature });
      setUser(data.user);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to link wallet');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, walletProvider, signNonce, setUser]);

  return { address, isConnected, loginWithWallet, linkWallet, isLoading, error };
}
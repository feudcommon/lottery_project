import { useState } from 'react';
import { BrowserProvider, parseEther } from 'ethers';
import api from '../api/client';

export const useDeposit = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: get treasury address + rate from the backend
  const getDepositInfo = async () => {
    const response = await api.get('/api/deposit/info');
    return response.data as { treasuryAddress: string; scaiToCoinsRate: number };
  };

  // Step 2: ask the connected wallet to send native SCAI to the treasury,
  // and WAIT for it to be mined before returning. This is the fix: the old
  // version returned tx.hash immediately after submission, so the backend
  // was asked to verify a transaction that often wasn't mined yet, which
  // it correctly rejected as "not confirmed" — that's the intermittent
  // failure you were seeing, not a real bug in the payment itself.
  const sendScai = async (amountScai: number) => {
    if (!window.ethereum) {
      throw new Error('No wallet found. Connect a wallet first.');
    }
    const { treasuryAddress } = await getDepositInfo();

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const tx = await signer.sendTransaction({
      to: treasuryAddress,
      value: parseEther(amountScai.toString()),
    });

    // Wait for at least 1 confirmation. This is what was missing before.
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed on-chain. No coins were charged — please try again.');
    }

    return tx.hash;
  };

  // Step 3: tell the backend to verify that tx and credit coins.
  // Retries a few times with a short delay, since even after tx.wait(1)
  // resolves in the wallet, the backend's own RPC node can occasionally
  // lag a block or two behind before it sees the same receipt.
  const confirmDeposit = async (txHash: string, attempts = 3) => {
    setIsLoading(true);
    setError(null);
    try {
      for (let i = 0; i < attempts; i++) {
        try {
          const response = await api.post('/api/deposit', { txHash });
          return response.data;
        } catch (err: any) {
          const status = err?.response?.status;
          const isLastAttempt = i === attempts - 1;
          // 404 = "not found on chain yet" from the backend — worth retrying.
          // Anything else (400/409/etc.) is a real rejection, don't retry.
          if (status === 404 && !isLastAttempt) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw err;
        }
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Deposit failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Convenience: does the full send + confirm flow in one call
  const buyCoinsWithScai = async (amountScai: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const txHash = await sendScai(amountScai);
      return await confirmDeposit(txHash);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Deposit failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { getDepositInfo, sendScai, confirmDeposit, buyCoinsWithScai, isLoading, error };
};
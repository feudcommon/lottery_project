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

  // Step 2: ask the connected wallet to send native SCAI to the treasury
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

    return tx.hash;
  };

  // Step 3: tell the backend to verify that tx and credit coins
  const confirmDeposit = async (txHash: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/deposit', { txHash });
      return response.data;
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
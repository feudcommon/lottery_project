import { useState } from 'react';
import api from '../api/client';

export const useWithdraw = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestWithdrawal = async (walletAddress: string, amountCoins: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/withdraw', {
        walletAddress,
        amountCoins,
      });
      return response.data;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Withdrawal failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { requestWithdrawal, isLoading, error };
};
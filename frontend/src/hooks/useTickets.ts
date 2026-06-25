import { useState } from 'react';
import api from '../api/client.ts';
import { useUserStore } from '../store/userStore.ts';

export const useTickets = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, setUser } = useUserStore();

  const buyTicket = async (drawDate?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/buy-ticket', {
        drawDate: drawDate || new Date().toISOString().split('T')[0],
      });

      if (user) {
        setUser({ ...user, coins: response.data.userCoins });
      }

      return response.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to buy ticket';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { buyTicket, isLoading, error };
};
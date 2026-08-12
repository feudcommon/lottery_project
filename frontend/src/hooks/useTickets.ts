import { useState } from 'react';
import api from '../api/client';
import { useUserStore } from '../store/userStore';

export const useTickets = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, setUser } = useUserStore();

  const buyTicket = async (slotNumber: number, drawDate?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Only send drawDate if the caller explicitly passed one — computing
      // "today" here with toISOString() would be UTC, which disagrees with
      // the backend's CRON_TIMEZONE for part of every day. Omitting it lets
      // the backend compute "today" itself, timezone-aware.
      const response = await api.post('/api/buy-ticket', {
        slotNumber,
        ...(drawDate ? { drawDate } : {}),
      });
      if (user) {
        setUser({ ...user, coins: response.data.ticket.coinsRemaining });
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
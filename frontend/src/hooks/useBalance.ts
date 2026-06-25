import { useEffect, useState } from 'react';
import api from '../api/client.ts';
import { useUserStore } from '../store/userStore.ts';

export const useBalance = (refreshInterval = 5000) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user, setUser } = useUserStore();

  const fetchBalance = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/user/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchBalance, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { coins: user?.coins || 0, isLoading, refetch: fetchBalance };
};
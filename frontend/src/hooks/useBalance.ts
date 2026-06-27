import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useUserStore } from '../store/userStore';

export const useBalance = (refreshInterval = 5000) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user, setUser } = useUserStore();

  const fetchBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/user/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    const interval = setInterval(fetchBalance, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchBalance, refreshInterval]);

  return { coins: user?.coins || 0, isLoading, refetch: fetchBalance };
};
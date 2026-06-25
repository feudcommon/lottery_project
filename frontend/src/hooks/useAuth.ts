import { useState } from 'react';
import api from '../api/client.ts';
import { useUserStore } from '../store/userStore.ts';

declare global {
  interface Window {
    Telegram: any;
  }
}

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser, setToken } = useUserStore();

  const loginWithTelegram = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        throw new Error('Telegram WebApp not available');
      }

      const telegramData = tg.initData;
      if (!telegramData) {
        throw new Error('No Telegram data available');
      }

      const response = await api.post('/api/auth/telegram', {
        initData: telegramData,
      });

      const { token, user } = response.data;
      setToken(token);
      setUser(user);

      window.location.href = '/home';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { loginWithTelegram, isLoading, error };
};
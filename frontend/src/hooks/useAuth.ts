import { useState } from 'react';
import api from '../api/client';
import { useUserStore } from '../store/userStore';

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
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) {
        console.warn('Telegram WebApp not available - running in browser mode');
        // Provide mock data or redirect to Telegram
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

  const loginWithBrowserTelegram = async (telegramUser: Record<string, unknown>) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/auth/telegram-browser', telegramUser);
      setToken(response.data.token);
      setUser(response.data.user);
      window.location.href = '/home';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Telegram browser login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return { loginWithTelegram, loginWithBrowserTelegram, isLoading, error };
};

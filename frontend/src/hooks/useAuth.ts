import { useState } from 'react';
import api from '../api/client';
import { useUserStore } from '../store/userStore';
import type { TelegramWidgetUser } from '../components/TelegramLoginWidget';

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
        // Not running inside the Telegram Mini App (e.g. plain browser visit).
        // There's nothing to read initData from here, so stop instead of
        // crashing on `tg.initData`. The website falls back to the Telegram
        // Login Widget (see loginWithBrowserTelegram / TelegramLoginWidget).
        throw new Error('Open this app from Telegram, or sign in with the Telegram button below.');
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

  const loginWithBrowserTelegram = async (telegramUser: TelegramWidgetUser) => {
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
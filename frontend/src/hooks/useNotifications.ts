import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useUserStore } from '../store/userStore';

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  reference_id: number | null;
  is_read: number;
  created_at: string;
}

// Polls for the current user's unread notifications (e.g. "you won!").
// This is the fallback channel for wallet-only users who have no Telegram
// identity to DM — everyone sees this next time they open the site,
// regardless of how they logged in.
export const useNotifications = (pollInterval = 15000) => {
  const { token } = useUserStore();
  const [unread, setUnread] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const response = await api.get('/api/notifications', { params: { unreadOnly: true } });
      setUnread(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const markAsRead = useCallback(async (id: number) => {
    // Optimistic update so the banner disappears immediately on dismiss,
    // rather than waiting for the next poll.
    setUnread((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setUnread([]);
    try {
      await api.post('/api/notifications/read-all');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(fetchUnread, pollInterval);
    return () => clearInterval(interval);
  }, [fetchUnread, pollInterval, token]);

  return { unread, isLoading, markAsRead, markAllAsRead, refetch: fetchUnread };
};
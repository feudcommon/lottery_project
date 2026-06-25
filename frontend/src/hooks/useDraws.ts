import { useEffect, useState } from 'react';
import api from '../api/client';

interface Draw {
  date: string;
  seedHash: string;
  seed: string | null;
  winnerId: number | null;
  status: 'pending' | 'completed' | 'cancelled';
  revealed: boolean;
}

export const useDraws = (drawDate?: string) => {
  const [draw, setDraw] = useState<Draw | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDraw = async () => {
      try {
        const date = drawDate || new Date().toISOString().split('T')[0];
        const response = await api.get(`/api/draws/${date}`);
        setDraw(response.data);
      } catch (error) {
        console.error('Failed to fetch draw:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDraw();
  }, [drawDate]);

  return { draw, isLoading };
};
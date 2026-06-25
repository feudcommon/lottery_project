
// src/components/DrawCountdown.tsx
import { useEffect, useState } from 'react';

/**
 * Shows countdown to next draw (18:00)
 * Updates every second
 */

export default function DrawCountdown() {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const draw = new Date();
      draw.setHours(18, 0, 0, 0);

      if (now > draw) {
        draw.setDate(draw.getDate() + 1);
      }

      const diff = draw.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${hours}h ${mins}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="font-bold mb-2">⏳ Next Draw</h2>
      <p className="text-3xl font-bold text-blue-600">{timeLeft}</p>
      <p className="text-sm text-gray-600 mt-2">Draw happens at 18:00</p>
    </div>
  );
}
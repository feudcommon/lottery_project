import { useState } from 'react';
import { useUserStore } from '../store/userStore.ts';
import { useBalance } from '../hooks/useBalance.ts';
import Header from '../components/Header.tsx';
import BalanceCard from '../components/BalanceCard.tsx';
import DrawCountdown from '../components/DrawCountdown.tsx';
import api from '../api/client.ts';

export default function Home() {
  const { coins, isLoading, refetch } = useBalance();
  const [spinLoading, setSpinLoading] = useState(false);
  const [lastSpinTime, setLastSpinTime] = useState(null);

  const canSpin = () => {
    if (!lastSpinTime) return true;
    const now = new Date();
    const hoursSince = (now.getTime() - lastSpinTime.getTime()) / (1000 * 60 * 60);
    return hoursSince >= 24;
  };

  const handleSpin = async () => {
    setSpinLoading(true);
    try {
      await api.post('/api/spin');
      setLastSpinTime(new Date());
      refetch();
    } catch (error) {
      console.error('Spin failed:', error);
    } finally {
      setSpinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
        <BalanceCard coins={coins} isLoading={isLoading} />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Daily Spin</h2>
          <p className="text-gray-600 mb-4">Claim 1 free coin once per day</p>
          <button
            onClick={handleSpin}
            disabled={!canSpin() || spinLoading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {spinLoading ? 'Claiming...' : canSpin() ? 'Claim Daily Reward' : 'Already claimed today'}
          </button>
        </div>
        <DrawCountdown />
        <div className="grid grid-cols-2 gap-4">
          <a href="/tickets" className="bg-blue-500 text-white p-4 rounded-lg text-center font-bold hover:bg-blue-600 transition">
            Buy Tickets
          </a>
          <a href="/draws" className="bg-purple-500 text-white p-4 rounded-lg text-center font-bold hover:bg-purple-600 transition">
            Results
          </a>
          <a href="/withdraw" className="bg-orange-500 text-white p-4 rounded-lg text-center font-bold hover:bg-orange-600 transition">
            Withdraw
          </a>
          <a href="/profile" className="bg-gray-500 text-white p-4 rounded-lg text-center font-bold hover:bg-gray-600 transition">
            Profile
          </a>
        </div>
      </div>
    </div>
  );
}
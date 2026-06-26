import { useState } from 'react';
import { useBalance } from '../hooks/useBalance';
import api from '../api/client';

export default function Home() {
  const { coins, isLoading, refetch } = useBalance();
  const [spinLoading, setSpinLoading] = useState(false);

  const handleSpin = async () => {
    setSpinLoading(true);
    try {
      await api.post('/api/spin');
      refetch();
    } catch (error) {
      console.error('Spin failed:', error);
    } finally {
      setSpinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-2">SCAI Lucky Loop</h1>
          <p className="text-gray-600">Your Balance: <span className="font-bold text-lg">{coins}</span> coins</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Daily Spin</h2>
          <p className="text-gray-600 mb-4">Claim 1 free coin once per day</p>
          <button
            onClick={handleSpin}
            disabled={spinLoading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {spinLoading ? 'Claiming...' : 'Claim Daily Reward'}
          </button>
        </div>

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
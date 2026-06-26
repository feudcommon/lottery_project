import { useEffect, useState } from 'react';
import { useBalance } from '../hooks/useBalance';
import { useTickets } from '../hooks/useTickets';
import api from '../api/client';

export default function Tickets() {
  const { coins } = useBalance();
  const { buyTicket, isLoading, error } = useTickets();
  const [tickets, setTickets] = useState<number[]>([]);
  const [yourTickets, setYourTickets] = useState<number[]>([]);

  useEffect(() => {
    api.get('/api/tickets/today').then(res => {
      setTickets(res.data.tickets || []);
      setYourTickets(res.data.yourSlots || []);
    }).catch(err => console.error('Failed to fetch tickets:', err));
  }, []);

  const handleBuyTicket = async (slotNumber: number) => {
    try {
      await buyTicket();
      const res = await api.get('/api/tickets/today');
      setTickets(res.data.tickets || []);
      setYourTickets(res.data.yourSlots || []);
    } catch (err) {
      console.error('Failed to buy ticket:', err);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Today's Lottery</h1>
      
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <p className="text-gray-600 mb-2">Your coins: <span className="font-bold text-lg">{coins}</span></p>
        <p className="text-sm text-gray-500">Cost per ticket: 10 coins</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-5 gap-2 mb-4">
        {Array.from({ length: 50 }).map((_, i) => (
          <button
            key={i}
            onClick={() => handleBuyTicket(i)}
            disabled={yourTickets.includes(i) || coins < 10 || isLoading}
            className={`p-3 rounded text-sm font-bold transition ${
              yourTickets.includes(i)
                ? 'bg-green-500 text-white cursor-not-allowed'
                : tickets.includes(i)
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {i}
          </button>
        ))}
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>Your tickets</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <span>Sold</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Available</span>
        </div>
      </div>
    </div>
  );
}
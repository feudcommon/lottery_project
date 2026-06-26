import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Draws() {
  const [draws, setDraws] = useState<any[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<any | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    api.get('/api/draws/history?days=7').then(res => {
      setDraws(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedDraw(res.data[0]);
      }
    }).catch(err => console.error('Failed to fetch draws:', err));
  }, []);

  const handleVerify = async (date: string) => {
    setVerifyLoading(true);
    try {
      const response = await api.get(`/api/draws/${date}/verify`);
      alert(response.data.verified ? 'Draw is fair!' : 'Draw verification failed');
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Draw Results</h1>

      {selectedDraw && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-bold mb-2">{selectedDraw.date}</h2>

          {selectedDraw.status === 'pending' ? (
            <p className="text-yellow-600 font-bold">Draw pending (18:00)</p>
          ) : selectedDraw.status === 'completed' ? (
            <>
              <p className="mb-2">
                <span className="text-gray-600">Winner:</span>
                <span className="font-bold ml-2">User #{selectedDraw.winnerId}</span>
              </p>
              <button
                onClick={() => handleVerify(selectedDraw.date)}
                disabled={verifyLoading}
                className="w-full bg-blue-500 text-white py-2 rounded font-bold hover:bg-blue-600 transition disabled:opacity-50"
              >
                {verifyLoading ? 'Verifying...' : 'Verify Draw'}
              </button>

              {selectedDraw.revealed && (
                <div className="mt-4 p-3 bg-gray-100 rounded text-xs break-all">
                  <p className="font-bold mb-1">Seed:</p>
                  <p className="font-mono">{selectedDraw.seed}</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      <h3 className="font-bold mb-2">Previous Draws</h3>
      <div className="space-y-2">
        {draws.map(draw => (
          <button
            key={draw.date}
            onClick={() => setSelectedDraw(draw)}
            className={`w-full p-3 rounded text-left transition ${
              selectedDraw?.date === draw.date
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <div className="font-bold">{draw.date}</div>
            <div className="text-sm">
              {draw.status === 'completed' ? `Winner: User #${draw.winnerId}` : 'Pending'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
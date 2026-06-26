import { useEffect, useState } from 'react';
import { useBalance } from '../hooks/useBalance';
import { useWithdraw } from '../hooks/useWithdraw';
import api from '../api/client';

export default function Withdraw() {
  const { coins } = useBalance();
  const { requestWithdrawal, isLoading, error } = useWithdraw();
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [eligibility, setEligibility] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get('/api/withdraw/eligibility').then(res => {
      setEligibility(res.data);
    }).catch(err => console.error('Failed to fetch eligibility:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestWithdrawal(walletAddress, Number(amount));
      setSubmitted(true);
      setWalletAddress('');
      setAmount('');
    } catch (err) {
      console.error('Withdrawal request failed:', err);
    }
  };

  if (!eligibility) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Withdraw LLT</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h2 className="font-bold mb-3">Eligibility Check</h2>
        <div className="space-y-2 text-sm">
          <div className={eligibility.coinsOk ? 'text-green-600' : 'text-red-600'}>
            {eligibility.coinsOk ? 'YES' : 'NO'} - Coins: {coins} / 1000 required
          </div>
          <div className={eligibility.referralsOk ? 'text-green-600' : 'text-red-600'}>
            {eligibility.referralsOk ? 'YES' : 'NO'} - Referrals: {eligibility.referralCount} / 5 required
          </div>
        </div>
      </div>

      {eligibility.coinsOk && eligibility.referralsOk ? (
        <>
          {submitted ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              Withdrawal request submitted! Pending admin approval.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Wallet Address</label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x742d35..."
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Amount (coins)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={coins}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Max: {coins}</p>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !walletAddress || !amount}
                className="w-full bg-blue-500 text-white font-bold py-3 rounded hover:bg-blue-600 transition disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Request Withdrawal'}
              </button>
            </form>
          )}
        </>
      ) : (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Need 1000 coins and 5 referrals to withdraw.
        </div>
      )}
    </div>
  );
}
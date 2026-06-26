import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/userStore';

export default function Login() {
  const { token } = useUserStore();
  const { loginWithTelegram, isLoading, error } = useAuth();

  useEffect(() => {
    if (token) window.location.href = '/home';
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-2">SCAI Lucky Loop</h1>
        <p className="text-center text-gray-600 mb-8">Daily lottery with verified randomness</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <button
          onClick={loginWithTelegram}
          disabled={isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
        >
          {isLoading ? 'Connecting...' : 'Connect with Telegram'}
        </button>

        <div className="mt-8 pt-8 border-t border-gray-200 text-sm text-gray-600">
          <h2 className="font-bold mb-3">How it works:</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Earn 1 coin daily</li>
            <li>Buy tickets (10 coins each)</li>
            <li>Fair draw (verifiable randomness)</li>
            <li>Withdraw LLT tokens</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
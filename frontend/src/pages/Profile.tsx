// src/pages/Profile.tsx
import { useUserStore } from '../store/userStore.ts';
import { useEffect, useState } from 'react';
import api from '../api/client.ts';

/**
 * Profile Page
 * 
 * Shows:
 * - User info (username, coins, referral count)
 * - Referral link (copy to clipboard)
 * - Stats (total earned, tickets bought, etc.)
 */

export default function Profile() {
  const { user, logout } = useUserStore();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user) {
      api.get('/api/user/me/stats').then(res => {
        setStats(res.data);
      });
    }
  }, [user]);

  const referralLink = `https://t.me/your_bot_name/app?ref=${user?.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Referral link copied!');
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">👤 Profile</h1>

      {user && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold mb-3">User Info</h2>
            <div className="space-y-2 text-sm">
              <div><span className="text-gray-600">Username:</span> <span className="font-bold">@{user.username}</span></div>
              <div><span className="text-gray-600">Coins:</span> <span className="font-bold">{user.coins}</span></div>
              <div><span className="text-gray-600">Referrals:</span> <span className="font-bold">{user.referralCount}</span></div>
              <div><span className="text-gray-600">Member since:</span> <span className="font-bold">{new Date(user.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold mb-3">Referral Program</h2>
            <p className="text-sm text-gray-600 mb-3">Invite friends and earn 500 coins per referral!</p>
            <button
              onClick={copyToClipboard}
              className="w-full bg-green-500 text-white font-bold py-2 rounded hover:bg-green-600 transition"
            >
              📋 Copy Referral Link
            </button>
            <p className="text-xs text-gray-500 mt-2 break-all">{referralLink}</p>
          </div>

          {stats && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold mb-3">Statistics</h2>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-600">Total coins earned:</span> <span className="font-bold">{stats.totalEarned}</span></div>
                <div><span className="text-gray-600">Tickets purchased:</span> <span className="font-bold">{stats.ticketsPurchased}</span></div>
                <div><span className="text-gray-600">Spins completed:</span> <span className="font-bold">{stats.spinsCompleted}</span></div>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="w-full bg-red-500 text-white font-bold py-2 rounded hover:bg-red-600 transition"
          >
            🚪 Logout
          </button>
        </div>
      )}
    </div>
  );
}
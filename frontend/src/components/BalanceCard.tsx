// src/components/BalanceCard.tsx
/**
 * Displays coin balance
 * Shows loading spinner while fetching
 */

export default function BalanceCard({ coins, isLoading }: { coins: number; isLoading: boolean }) {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
      <p className="text-sm opacity-90">Your Balance</p>
      {isLoading ? (
        <p className="text-4xl font-bold mt-2">...</p>
      ) : (
        <p className="text-4xl font-bold mt-2">{coins}</p>
      )}
      <p className="text-xs opacity-75 mt-2">Ã°Å¸â€™Â° SCAI coins</p>
    </div>
  );
}
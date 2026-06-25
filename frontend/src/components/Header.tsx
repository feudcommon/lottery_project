// src/components/Header.tsx
import { useUserStore } from '../store/userStore.ts';

/**
 * Reusable Header
 * Shows on every page
 * Contains navigation
 */

export default function Header() {
  const { user } = useUserStore();

  return (
    <header className="bg-blue-600 text-white p-4 sticky top-0 shadow">
      <div className="max-w-md mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">🎰 SCAI</h1>
        {user && (
          <div className="text-sm">
            <span className="font-bold">{user.coins}</span> coins
          </div>
        )}
      </div>
    </header>
  );
}   
import React from 'react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
//import { Analytics } from "@vercel/analytics/react";
import { useUserStore } from './store/userStore';
import Login from './pages/Login';
import Home from './pages/Home';
import Tickets from './pages/Tickets';
import Draws from './pages/Draws';
import Withdraw from './pages/Withdraw';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Jackpot from './pages/Jackpot';
import About from './pages/About';
import HowItWorks from './pages/HowItWorks';
import GameRules from './pages/GameRules';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import WinnerNotification from './components/WinnerNotification';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useUserStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token } = useUserStore();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); }
  }, []);

  return (
    <BrowserRouter>
      {/* <Analytics /> */}
      {/* Shows a "you won!" modal on load/poll if there's anything unread —
          works for wallet-only users too, unlike the Telegram DM. */}
      {token && <WinnerNotification />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
        <Route path="/draws" element={<ProtectedRoute><Draws /></ProtectedRoute>} />
        <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
        <Route path="/jackpot" element={<ProtectedRoute><Jackpot /></ProtectedRoute>} />

        {/* Public info pages, linked from the nav bar */}
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/rules" element={<GameRules />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
import React from 'react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
//import { Analytics } from "@vercel/analytics/react";
import { useUserStore } from './store/userStore';
import Login from './pages/Login.tsx';
import Home from './pages/Home.tsx';
import Tickets from './pages/Tickets.tsx';
import Draws from './pages/Draws.tsx';
import Withdraw from './pages/Withdraw.tsx';
import Profile from './pages/Profile.tsx';
import Leaderboard from './pages/Leaderboard.tsx';
import Jackpot from './pages/Jackpot.tsx';
import About from './pages/About.tsx';
import HowItWorks from './pages/HowItWorks.tsx';
import GameRules from './pages/GameRules.tsx';
import FAQ from './pages/FAQ.tsx';
import Contact from './pages/Contact.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useUserStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) { tg.ready(); tg.expand(); }
  }, []);

  return (
    <BrowserRouter>
      {/* <Analytics /> */}
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
      </Routes>
    </BrowserRouter>
  );
}
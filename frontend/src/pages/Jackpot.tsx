import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gem } from 'lucide-react';
import api from '../api/client';

export default function Jackpot() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/jackpot/status').then(res => setStatus(res.data)).catch(console.error);
    api.get('/api/jackpot/history?limit=6').then(res => setHistory(res.data.history || [])).catch(console.error);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #07050f 0%, #1a0f2e 100%)',
      color: '#fff', fontFamily: 'sans-serif', paddingBottom: '2rem',
    }}>
      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'rgba(232, 121, 249, 0.1)', border: '1px solid rgba(232, 121, 249, 0.3)',
            color: '#fff', width: 40, height: 40, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{
            fontSize: 20, fontWeight: 'bold',
            background: 'linear-gradient(90deg, #e879f9, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0,
          }}>
            Weekly Jackpot
          </h1>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(232, 121, 249, 0.15)',
          borderRadius: 20, padding: '2rem', marginBottom: '1.5rem', textAlign: 'center',
          boxShadow: '0 0 40px rgba(192, 38, 211, 0.1)',
        }}>
          <Gem size={28} style={{ marginBottom: 8 }} color="#e879f9" />
          <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a0aec0', marginBottom: 6 }}>
            Current Pool
          </div>
          <div style={{
            fontSize: 44, fontWeight: 800,
            background: 'linear-gradient(90deg, #e879f9, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {status?.poolAmount ?? 0}
          </div>
          <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>coins</div>
          {status && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
              Week {status.weekStart} – {status.weekEnd} · {status.status}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>
            Buy any ticket this week to enter. Winner drawn Sunday.
          </div>
        </div>

        <div style={{ fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a0aec0', marginBottom: '1rem' }}>
          Past Jackpots
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {history.map((j) => (
            <div key={j.id} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,121,249,0.15)',
              borderRadius: 12, padding: '1rem',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{j.week_start} – {j.week_end}</div>
              <div style={{ fontSize: 12, color: '#a0aec0' }}>
                {j.status === 'drawn'
                  ? `Winner: User #${j.winner_user_id} · ${j.pool_amount} coins`
                  : `Pool: ${j.pool_amount} coins · ${j.status}`}
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <div style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>No history yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
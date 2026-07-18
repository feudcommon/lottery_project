import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import api from '../api/client';

interface Row {
  id: number;
  username: string;
  coins: number;
  referral_count: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/leaderboard?limit=20')
      .then(res => {
        setRows(res.data.leaderboard || []);
        setMyRank(res.data.myRank);
      })
      .catch(err => console.error('Failed to fetch leaderboard:', err))
      .finally(() => setLoading(false));
  }, []);

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #07050f 0%, #1a0f2e 100%)',
      color: '#fff',
      fontFamily: 'sans-serif',
      paddingBottom: '2rem',
    }}>
      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(232, 121, 249, 0.1)', border: '1px solid rgba(232, 121, 249, 0.3)',
              color: '#fff', width: 40, height: 40, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{
            fontSize: 20, fontWeight: 'bold',
            background: 'linear-gradient(90deg, #e879f9, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: 0,
          }}>
            Leaderboard
          </h1>
        </div>

        {myRank && (
          <div style={{
            background: 'rgba(232, 121, 249, 0.1)', border: '1px solid rgba(232, 121, 249, 0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: '1rem', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Trophy size={16} color="#e879f9" /> Your rank: <strong>#{myRank}</strong>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: i < 3 ? 'rgba(232, 121, 249, 0.08)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(232, 121, 249, 0.15)', borderRadius: 12, padding: '12px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 'bold', minWidth: 32 }}>{medal(i)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>@{r.username}</div>
                    <div style={{ fontSize: 11, color: '#a0aec0' }}>{r.referral_count} referrals</div>
                  </div>
                </div>
                <div style={{
                  fontWeight: 'bold', fontSize: 15,
                  background: 'linear-gradient(90deg, #e879f9, #a78bfa)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  {r.coins}
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>No players yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
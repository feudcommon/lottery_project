import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';

export default function Draws() {
  const navigate = useNavigate();
  const [draws, setDraws] = useState<any[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<any | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/draws/history?days=7')
      .then(res => {
        // Backend returns { draws: [...] }, not a bare array
        const drawList = res.data?.draws || [];
        setDraws(drawList);
        if (drawList.length > 0) {
          setSelectedDraw(drawList[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch draws:', err);
        setLoading(false);
      });
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #07050f 0%, #1a0f2e 100%)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'sans-serif',
    }}>
      {/* Background smoke */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 60% at 20% 30%, #3b0764bb 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 50% at 80% 60%, #831843aa 0%, transparent 60%)' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '1.5rem' }}>
        {/* Header with Back Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(232, 121, 249, 0.1)',
              border: '1px solid rgba(232, 121, 249, 0.3)',
              color: '#fff',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              padding: '0',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(232, 121, 249, 0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(232, 121, 249, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #e879f9, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: '0',
            flex: 1,
            textAlign: 'center',
          }}>
            Draw Results
          </h1>
          <div style={{ width: '40px' }} />
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ color: '#a0aec0' }}>Loading draws...</div>
          </div>
        ) : (
          <>
            {/* Selected Draw Card */}
            {selectedDraw && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(232, 121, 249, 0.15)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                boxShadow: '0 0 40px rgba(192, 38, 211, 0.1)',
              }}>
                <div style={{ fontSize: '14px', color: '#e879f9', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {selectedDraw.draw_date}
                </div>

                {selectedDraw.status === 'drawn' ? (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ color: '#a0aec0', fontSize: '12px', margin: '0 0 0.5rem 0' }}>Winner</p>
                      <p style={{ fontSize: '18px', fontWeight: 'bold', background: 'linear-gradient(90deg, #e879f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: '0' }}>
                        User #{selectedDraw.winner_user_id}
                      </p>
                      {selectedDraw.reward_amount != null && (
                        <p style={{ color: '#a0aec0', fontSize: '12px', margin: '0.5rem 0 0 0' }}>
                          Reward: {selectedDraw.reward_amount} coins
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleVerify(selectedDraw.draw_date)}
                      disabled={verifyLoading}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '100px',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 0 30px rgba(192, 38, 211, 0.35)',
                        opacity: verifyLoading ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => !verifyLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      {verifyLoading ? 'Verifying...' : 'Verify Draw'}
                    </button>

                    {selectedDraw.random_seed && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '12px',
                        background: 'rgba(232, 121, 249, 0.05)',
                        border: '1px solid rgba(232, 121, 249, 0.2)',
                        borderRadius: '8px',
                      }}>
                        <p style={{ fontSize: '12px', color: '#a0aec0', margin: '0 0 0.5rem 0' }}>Revealed Seed:</p>
                        <p style={{ fontSize: '12px', fontFamily: 'monospace', color: '#cbd5e1', margin: '0', wordBreak: 'break-all' }}>
                          {selectedDraw.random_seed}
                        </p>
                      </div>
                    )}
                  </>
                ) : selectedDraw.status === 'closed' ? (
                  <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '14px' }}>
                    Sales closed — draw pending
                  </div>
                ) : (
                  <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '14px' }}>
                    Sales open — draw pending
                  </div>
                )}
              </div>
            )}

            {/* Previous Draws List */}
            {draws.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a0aec0', marginBottom: '1rem', fontWeight: '600' }}>
                  Previous Draws
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {draws.map(draw => (
                    <button
                      key={draw.draw_date}
                      onClick={() => setSelectedDraw(draw)}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '12px',
                        textAlign: 'left',
                        border: selectedDraw?.draw_date === draw.draw_date
                          ? '1px solid rgba(232, 121, 249, 0.5)'
                          : '1px solid rgba(232, 121, 249, 0.15)',
                        background: selectedDraw?.draw_date === draw.draw_date
                          ? 'rgba(232, 121, 249, 0.1)'
                          : 'rgba(255, 255, 255, 0.04)',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontSize: '14px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(232, 121, 249, 0.1)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = selectedDraw?.draw_date === draw.draw_date
                          ? 'rgba(232, 121, 249, 0.1)'
                          : 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{draw.draw_date}</div>
                      <div style={{ fontSize: '12px', color: '#a0aec0' }}>
                        {draw.status === 'drawn' ? `Winner: User #${draw.winner_user_id}` : 'Pending'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {draws.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#a0aec0' }}>
                No draws found
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBalance } from '../hooks/useBalance';
import { useTickets } from '../hooks/useTickets';
import api from '../api/client';

export default function Tickets() {
  const navigate = useNavigate();
  const { coins } = useBalance();
  const { buyTicket, isLoading, error } = useTickets();
  const [tickets, setTickets] = useState<number[]>([]);
  const [yourTickets, setYourTickets] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/tickets/today')
      .then(res => {
        setTickets(res.data.tickets || []);
        setYourTickets(res.data.yourSlots || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch tickets:', err);
        setLoading(false);
      });
  }, []);

  const handleBuyTicket = async (slotNumber: number) => {
    try {
      await buyTicket();
      const res = await api.get('/api/tickets/today');
      setTickets(res.data.tickets || []);
      setYourTickets(res.data.yourSlots || []);
    } catch (err) {
      console.error('Failed to buy ticket:', err);
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
      paddingBottom: '2rem',
    }}>
      {/* Background smoke */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 60% at 20% 30%, #3b0764bb 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 50% at 80% 60%, #831843aa 0%, transparent 60%)' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '1.5rem' }}>
        {/* Header with Back Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
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
              flexShrink: 0,
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
          }}>
            Today's Lottery
          </h1>
        </div>

        {/* Balance Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(232, 121, 249, 0.15)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 0 40px rgba(192, 38, 211, 0.1)',
        }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#a0aec0', marginBottom: '0.5rem' }}>
            Your Coins
          </div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', background: 'linear-gradient(90deg, #e879f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: '0 0 0.5rem 0' }}>
            {coins}
          </div>
          <div style={{ fontSize: '12px', color: '#a0aec0' }}>Cost per ticket: 10 coins</div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '1rem',
            fontSize: '14px',
            color: '#fca5a5',
          }}>
            {error}
          </div>
        )}

        {/* Tickets Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>Loading tickets...</div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '0.5rem',
              marginBottom: '1.5rem',
            }}>
              {Array.from({ length: 50 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleBuyTicket(i)}
                  disabled={yourTickets.includes(i) || coins < 10 || isLoading}
                  style={{
                    aspectRatio: '1',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: yourTickets.includes(i) || coins < 10 || isLoading ? 'not-allowed' : 'pointer',
                    background: yourTickets.includes(i)
                      ? 'linear-gradient(135deg, #34d399, #10b981)'
                      : tickets.includes(i)
                      ? 'rgba(107, 114, 128, 0.3)'
                      : 'linear-gradient(135deg, #7c3aed, #c026d3)',
                    color: '#fff',
                    transition: 'all 0.2s ease',
                    opacity: yourTickets.includes(i) || tickets.includes(i) ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!yourTickets.includes(i) && !tickets.includes(i) && coins >= 10 && !isLoading) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(192, 38, 211, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {i}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', fontSize: '12px', color: '#a0aec0', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', background: 'linear-gradient(135deg, #34d399, #10b981)', borderRadius: '4px' }} />
                <span>Your tickets</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', background: 'rgba(107, 114, 128, 0.3)', borderRadius: '4px' }} />
                <span>Sold</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', background: 'linear-gradient(135deg, #7c3aed, #c026d3)', borderRadius: '4px' }} />
                <span>Available</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
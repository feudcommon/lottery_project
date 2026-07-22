import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/userStore';
import Navbar from '../components/Navbar';
import { ShieldCheck, Users, Trophy, Coins } from 'lucide-react';

// Live jackpot / countdown / stats shown in the hero's right panel.
// TODO: wire to real endpoints (jackpot pool, next draw time, player count,
// recent winner) once those are exposed on the public API — placeholder
// values below are clearly structured so swapping in real data is a
// one-line change per field, not a redesign.
const DRAW_HOUR_UTC = 18;

function useCountdown() {
  const [label, setLabel] = useState('--:--:--');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DRAW_HOUR_UTC, 0, 0));
      if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
      const diff = next.getTime() - now.getTime();
      const h = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0');
      setLabel(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return label;
}

export default function Login() {
  const navigate = useNavigate();
  const { token } = useUserStore();
  const { loginWithTelegram, isLoading, error } = useAuth();
  const countdown = useCountdown();

  useEffect(() => {
    if (token) navigate('/home', { replace: true });
  }, [navigate, token]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#07050f',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Navbar />

      <div
        className="hero-grid"
        style={{
          position: 'relative',
          overflow: 'hidden',
          maxWidth: 1180,
          margin: '0 auto',
          padding: '3.5rem 1.5rem 4rem',
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: '2.5rem',
          alignItems: 'center',
        }}
      >
        {/* Ambient background */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 15% 25%, #3b0764aa 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 50% at 90% 70%, #831843aa 0%, transparent 60%)' }} />
          <div
            style={{
              position: 'absolute', inset: 0, opacity: 0.045,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: '200px',
            }}
          />
          <div
            style={{
              position: 'absolute', top: '48%', left: '8%', transform: 'translateY(-50%)',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 150, fontWeight: 800, color: 'rgba(255,255,255,0.055)',
              letterSpacing: '0.02em', whiteSpace: 'nowrap', textTransform: 'uppercase', userSelect: 'none',
            }}
          >
            LUCKY
          </div>
        </div>

        {/* LEFT: copy + CTA */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#e879f9', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 24, height: 1, background: '#e879f9' }} />
            Daily Lottery &middot; SCAI Network
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(40px, 5.2vw, 64px)',
              fontWeight: 800,
              lineHeight: 1.02,
              color: '#fff',
              letterSpacing: '-0.02em',
              margin: '0 0 1.1rem',
            }}
          >
            One ticket.
            <br />
            <span
              style={{
                background: 'linear-gradient(90deg,#e879f9,#a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Every day, a winner.
            </span>
          </h1>

          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)', maxWidth: 440, margin: '0 0 1.75rem' }}>
            Buy in with coins, earn free entries daily, and watch a provably
            fair draw settle on-chain — every single day, no exceptions.
          </p>

          {/* Audit badge */}
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(52,211,153,0.25)',
              borderRadius: 100, padding: '6px 14px 6px 8px',
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>
                Smart contract audited by
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#34d399', lineHeight: 1.2 }}>
                EtherAuthority
              </div>
            </div>
          </div>

          {error && (
            <div style={{ borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', maxWidth: 420 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: '2.25rem' }}>
            <button
              onClick={loginWithTelegram}
              disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 28px',
                border: 'none', borderRadius: 100,
                background: 'linear-gradient(135deg,#7c3aed,#c026d3)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.01em', whiteSpace: 'nowrap',
                boxShadow: '0 0 30px rgba(192,38,211,0.35)',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? 'Connecting…' : 'Connect with Telegram'}
            </button>
            
              href="/how-it-works"
              style={{
                fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
                padding: '13px 22px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              How it works
            </a>
          </div>

          {/* Stat row */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {[
              { num: '1', label: 'Free coin daily' },
              { num: '10', label: 'Coins per ticket' },
              { num: '∞', label: 'Withdrawals' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: signature loop visual + live game info */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 28,
              padding: '2rem 1.75rem 1.75rem',
              backdropFilter: 'blur(6px)',
            }}
          >
            {/* Rotating ring, the "Loop" signature element */}
            <div style={{ position: 'relative', width: 236, height: 236, margin: '0 auto 1.5rem' }}>
              <div className="loop-ring" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px dashed rgba(232,121,249,0.35)',
              }} />
              <div className="loop-ring-inner" style={{
                position: 'absolute', inset: 18, borderRadius: '50%',
                border: '1px solid rgba(167,139,250,0.2)',
              }} />
              {/* Orbiting ticket dots */}
              <div className="loop-ring" style={{ position: 'absolute', inset: 0 }}>
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <div
                    key={deg}
                    style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: 9, height: 9, borderRadius: '50%',
                      background: deg === 0 ? '#e879f9' : 'rgba(167,139,250,0.55)',
                      boxShadow: deg === 0 ? '0 0 12px #e879f9' : 'none',
                      transform: `rotate(${deg}deg) translate(118px) rotate(-${deg}deg)`,
                    }}
                  />
                ))}
              </div>
              {/* Center jackpot readout */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  Today's Jackpot
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                  4,850
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e879f9', marginLeft: 5 }}>coins</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>Next draw in</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.03em' }}>
                  {countdown}
                </div>
              </div>
            </div>

            {/* Mini stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: Users, label: 'Total players', value: '12,480' },
                { icon: Trophy, label: 'Recent winner', value: '@lucky_x7' },
                { icon: Coins, label: 'Prize pool', value: '182K' },
                { icon: ShieldCheck, label: 'Draw method', value: 'On-chain' },
              ].map(({ icon: Icon, label, value }, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    padding: '10px 12px',
                  }}
                >
                  <Icon size={13} color="#e879f9" strokeWidth={2} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 6 }}>{value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Telegram preview strip */}
            <div
              style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 9,
                background: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.2)',
                borderRadius: 100, padding: '7px 12px',
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#29b6f6', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                Also playable inside <strong style={{ color: '#fff' }}>@ScaiLuckyLoop_bot</strong> on Telegram
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin-loop { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .loop-ring { animation: spin-loop 24s linear infinite; }
        .loop-ring-inner { animation: spin-loop 18s linear infinite reverse; }
        @media (prefers-reduced-motion: reduce) {
          .loop-ring, .loop-ring-inner { animation: none; }
        }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; padding-top: 2.25rem !important; }
        }
      `}</style>
    </div>
  );
}
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useEffect, useState } from 'react';
import { ArrowLeft, Copy, LogOut } from 'lucide-react';
import api from '../api/client';

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useUserStore();
  const [stats, setStats] = useState<any>(null);
  const [copiedType, setCopiedType] = useState<'telegram' | 'website' | null>(null);

  useEffect(() => {
    if (user) {
      api.get('/api/user/me/stats')
        .then(res => {
          setStats(res.data);
        })
        .catch(err => console.error('Failed to fetch stats:', err));
    }
  }, [user]);

  // Two separate links so a referrer can share the right one depending on
  // where their friend will actually sign up:
  //  - Telegram Mini App deep link: `startapp` becomes `start_param` inside
  //    the app once opened from Telegram (a plain `?ref=` on a t.me link is
  //    never delivered to the app).
  //  - Website link: a normal `?ref=` query param, read on the /login page.
  // Both must carry `referral_code` (not the internal numeric id), since
  // that's what the backend matches new signups against.
  const telegramReferralLink = `https://t.me/ScaiLuckyLoop_bot/app?startapp=${user?.referralCode}`;
  const websiteReferralLink = `${window.location.origin}/login?ref=${user?.referralCode}`;

  const copyToClipboard = (type: 'telegram' | 'website') => {
    const link = type === 'telegram' ? telegramReferralLink : websiteReferralLink;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedType(type);
        setTimeout(() => setCopiedType(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy referral link:', err);
      });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
      <div style={{ position: 'relative', zIndex: 2, padding: '1.5rem', maxWidth: 480, margin: '0 auto' }}>
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
            Profile
          </h1>
        </div>

        {user && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* User Info Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(232, 121, 249, 0.15)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 0 40px rgba(192, 38, 211, 0.1)',
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e879f9', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
                User Info
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '0.25rem' }}>Username</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>@{user.username}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '0.25rem' }}>Coins</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', background: 'linear-gradient(90deg, #e879f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {user.coins}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '0.25rem' }}>Referrals</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{user.referralCount}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '0.25rem' }}>Member Since</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Program Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(232, 121, 249, 0.15)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 0 40px rgba(192, 38, 211, 0.1)',
            }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e879f9', margin: '0 0 1rem 0' }}>
                Referral Program
              </h2>
              <p style={{ fontSize: '13px', color: '#a0aec0', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
                Invite friends and earn 500 coins per referral!
              </p>
              <p style={{ fontSize: '11px', color: '#71809a', margin: '0 0 0.75rem 0' }}>
                Share the Telegram link with friends who'll play in Telegram, or the website link with friends who'll play in a browser.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  onClick={() => copyToClipboard('telegram')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #34d399, #10b981)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '100px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 0 30px rgba(52, 211, 153, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 211, 153, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(52, 211, 153, 0.35)';
                  }}
                >
                  <Copy size={16} />
                  {copiedType === 'telegram' ? 'Copied!' : 'Copy Telegram Link'}
                </button>

                <button
                  onClick={() => copyToClipboard('website')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(167, 139, 250, 0.12)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    color: '#fff',
                    borderRadius: '100px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(167, 139, 250, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(167, 139, 250, 0.12)';
                  }}
                >
                  <Copy size={16} />
                  {copiedType === 'website' ? 'Copied!' : 'Copy Website Link'}
                </button>
              </div>
            </div>

            {/* Statistics Card */}
            {stats && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(232, 121, 249, 0.15)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 0 40px rgba(192, 38, 211, 0.1)',
              }}>
                <h2 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e879f9', margin: '0 0 1rem 0' }}>
                  Statistics
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '0.25rem' }}>Total Earned</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{stats.totalEarned} coins</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '0.25rem' }}>Tickets Purchased</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{stats.ticketsPurchased}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '0.25rem' }}>Spins Completed</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{stats.spinsCompleted}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none',
                color: '#fff',
                borderRadius: '100px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 0 30px rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(239, 68, 68, 0.35)';
              }}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
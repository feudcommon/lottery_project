import type { CSSProperties } from 'react';
import { useNotifications } from '../hooks/useNotifications';

// Shows a celebratory modal for any unread win notification, and a plain
// toast-style banner for anything else. Mounted once near the root of the
// app (see App.tsx) so it works no matter which page the user lands on
// after logging back in.
export default function WinnerNotification() {
  const { unread, markAsRead } = useNotifications();

  if (unread.length === 0) return null;

  // Show the most recent one at a time; dismissing it reveals the next.
  const current = unread[0];
  const isWin = current.type === 'lottery_win' || current.type === 'jackpot_win';

  if (isWin) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {current.type === 'jackpot_win' ? '🏆' : '🎉'}
          </div>
          <h2 style={{ margin: '0 0 8px', color: '#e879f9' }}>{current.title}</h2>
          <p style={{ margin: '0 0 24px', color: '#d1d5db', lineHeight: 1.5 }}>
            {current.message}
          </p>
          <button style={buttonStyle} onClick={() => markAsRead(current.id)}>
            Awesome, thanks!
          </button>
          {unread.length > 1 && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
              +{unread.length - 1} more notification{unread.length - 1 > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: simple non-blocking toast for future non-win notification types.
  return (
    <div style={toastStyle}>
      <strong>{current.title}</strong>
      <div style={{ fontSize: 13, marginTop: 4 }}>{current.message}</div>
      <button style={toastCloseStyle} onClick={() => markAsRead(current.id)}>
        ✕
      </button>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  background: '#1a1025',
  border: '1px solid #a855f7',
  borderRadius: 16,
  padding: '32px 28px',
  maxWidth: 360,
  width: '90%',
  textAlign: 'center',
  boxShadow: '0 0 40px rgba(168,85,247,0.4)',
};

const buttonStyle: CSSProperties = {
  background: 'linear-gradient(90deg, #a855f7, #ec4899)',
  color: 'white',
  border: 'none',
  borderRadius: 999,
  padding: '12px 28px',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
};

const toastStyle: CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: '#1a1025',
  border: '1px solid #a855f7',
  borderRadius: 12,
  padding: '14px 40px 14px 16px',
  maxWidth: 320,
  color: '#e5e7eb',
  zIndex: 1000,
};

const toastCloseStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 10,
  background: 'transparent',
  border: 'none',
  color: '#9ca3af',
  cursor: 'pointer',
};
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

// Client-side lock screen only. This does NOT replace real auth — the
// backend's requireAdmin check (Telegram ID / wallet / is_admin column)
// is what actually protects the /api/admin/* routes. This is just a
// screen so the panel isn't visibly wide open to anyone who loads /admin.
const ADMIN_PANEL_PASSWORD = '12345678';
const SESSION_KEY = 'scai_admin_unlocked';

export default function Admin() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === 'true'
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const date = new Date().toISOString().slice(0, 10);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();

    // No lockout, no attempt cap — this always re-checks against the
    // current input and lets the person try again immediately.
    if (passwordInput === ADMIN_PANEL_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setUnlocked(true);
      setPasswordError('');
      setPasswordInput('');
      setAttempts(0);
      return;
    }

    // Wrong guess: clear the field, bump the attempt count, and put focus
    // straight back in the box so the next try doesn't need an extra click.
    setAttempts((n) => n + 1);
    setPasswordError('Incorrect password. Try again.');
    setPasswordInput('');
    passwordInputRef.current?.focus();
  };

  const load = async () => {
    try {
      const [userResult, withdrawalResult, ticketResult] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/withdrawals/pending'),
        api.get(`/api/admin/tickets/${date}`),
      ]);
      setUsers(userResult.data.users || []);
      setWithdrawals(withdrawalResult.data.withdrawals || []);
      setTicketCount((ticketResult.data.tickets || []).length);
    } catch (error: any) {
      setNotice(
        error.response?.status === 403
          ? 'This account is not an administrator.'
          : 'Unable to load admin data.'
      );
    }
  };

  useEffect(() => {
    if (unlocked) load();
  }, [unlocked]);

  const action = async (path: string, message: string) => {
    try {
      await api.post(path);
      setNotice(message);
      load();
    } catch (error: any) {
      setNotice(error.response?.data?.error || 'Action failed');
    }
  };

  if (!unlocked) {
    return (
      <main className="rules-page">
        <header>
          <Link className="brand" to="/home">
            SCAI <span>Admin</span>
          </Link>
          <Link className="button button-small" to="/home">
            Back to game
          </Link>
        </header>

        <p className="eyebrow">RESTRICTED OPERATIONS</p>
        <h1>Control panel</h1>

        <section className="content-section" style={{ maxWidth: 360, marginTop: 30 }}>
          <form onSubmit={handleUnlock}>
            <label htmlFor="admin-password">Admin password</label>
            <input
              id="admin-password"
              ref={passwordInputRef}
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError('');
              }}
              placeholder="Enter password"
              style={{
                display: 'block',
                width: '100%',
                margin: '8px 0 12px',
                padding: '10px 12px',
                borderRadius: 8,
              }}
            />
            {passwordError && (
              <p className="rules-intro" style={{ color: '#f87171' }}>
                {passwordError}
                {attempts > 2 ? ` (attempt ${attempts})` : ''}
              </p>
            )}
            <button className="button button-small" type="submit">
              Unlock
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="rules-page">
      <header>
        <Link className="brand" to="/home">
          SCAI <span>Admin</span>
        </Link>
        <Link className="button button-small" to="/home">
          Back to game
        </Link>
      </header>

      <p className="eyebrow">RESTRICTED OPERATIONS</p>
      <h1>Control panel</h1>
      {notice && <p className="rules-intro">{notice}</p>}

      <section className="stat-grid" style={{ marginTop: 30 }}>
        <article className="stat-card">
          <div>
            <small>Users</small>
            <strong>{users.length}</strong>
          </div>
        </article>
        <article className="stat-card">
          <div>
            <small>Tickets today</small>
            <strong>{ticketCount ?? '—'}</strong>
          </div>
        </article>
        <article className="stat-card">
          <div>
            <small>Pending payouts</small>
            <strong>{withdrawals.length}</strong>
          </div>
        </article>
        <article className="stat-card">
          <button
            className="button button-small"
            onClick={() => action(`/api/admin/draw/${date}/run`, "Draw executed.")}
          >
            Run today's draw
          </button>
        </article>
      </section>

      <section className="content-section">
        <h2>Pending withdrawals</h2>
        {withdrawals.length === 0 ? (
          <p className="rules-intro">No pending withdrawals.</p>
        ) : (
          withdrawals.map((item) => (
            <article className="step-card" style={{ marginBottom: 10 }} key={item.id}>
              <h3>
                #{item.id} · {item.token_amount} LLT
              </h3>
              <p>{item.wallet_address}</p>
              <div className="hero-actions">
                <button
                  className="button button-small"
                  onClick={() =>
                    action(`/api/admin/withdrawals/${item.id}/approve`, 'Withdrawal approved and sent.')
                  }
                >
                  Approve
                </button>
                <button
                  className="button button-secondary button-small"
                  onClick={() =>
                    action(`/api/admin/withdrawals/${item.id}/reject`, 'Withdrawal rejected and coins refunded.')
                  }
                >
                  Reject
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="content-section">
        <h2>Recent users</h2>
        <div className="rules-list">
          {users.slice(0, 20).map((user) => (
            <article key={user.id}>
              <b>#{user.id}</b>
              <div>
                <h2>
                  {user.username || 'Unnamed user'}
                  {Boolean(user.is_admin) && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 100,
                        background: 'rgba(232, 121, 249, 0.15)',
                        color: '#e879f9',
                        verticalAlign: 'middle',
                      }}
                    >
                      ADMIN
                    </span>
                  )}
                </h2>
                <p>
                  {user.coins} coins · {user.referral_count} referrals ·{' '}
                  {user.is_banned ? 'Banned' : 'Active'}
                </p>
                <div className="hero-actions" style={{ marginTop: 8 }}>
                  {Boolean(user.is_admin) ? (
                    <button
                      className="button button-secondary button-small"
                      onClick={() =>
                        action(`/api/admin/users/${user.id}/demote`, `Removed admin access from ${user.username || `#${user.id}`}.`)
                      }
                    >
                      Revoke admin
                    </button>
                  ) : (
                    <button
                      className="button button-small"
                      onClick={() =>
                        action(`/api/admin/users/${user.id}/promote`, `Granted admin access to ${user.username || `#${user.id}`}.`)
                      }
                    >
                      Make admin
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
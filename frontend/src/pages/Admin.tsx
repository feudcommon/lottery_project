import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const date = new Date().toISOString().slice(0, 10);

  const load = async () => {
    try {
      const [userResult, withdrawalResult, ticketResult] = await Promise.all([
        api.get('/api/admin/users'), api.get('/api/admin/withdrawals/pending'), api.get(`/api/admin/tickets/${date}`),
      ]);
      setUsers(userResult.data.users || []); setWithdrawals(withdrawalResult.data.withdrawals || []); setTicketCount((ticketResult.data.tickets || []).length);
    } catch (error: any) { setNotice(error.response?.status === 403 ? 'This account is not an administrator.' : 'Unable to load admin data.'); }
  };
  useEffect(() => { load(); }, []);
  const action = async (path: string, message: string) => { try { await api.post(path); setNotice(message); load(); } catch (error: any) { setNotice(error.response?.data?.error || 'Action failed'); } };

  return <main className="rules-page"><header><Link className="brand" to="/home">SCAI <span>Admin</span></Link><Link className="button button-small" to="/home">Back to game</Link></header><p className="eyebrow">RESTRICTED OPERATIONS</p><h1>Control panel</h1>{notice && <p className="rules-intro">{notice}</p>}<section className="stat-grid" style={{ marginTop: 30 }}><article className="stat-card"><div><small>Users</small><strong>{users.length}</strong></div></article><article className="stat-card"><div><small>Tickets today</small><strong>{ticketCount ?? 'â€”'}</strong></div></article><article className="stat-card"><div><small>Pending payouts</small><strong>{withdrawals.length}</strong></div></article><article className="stat-card"><button className="button button-small" onClick={() => action(`/api/admin/draw/${date}/run`, 'Draw executed.')}>Run todayâ€™s draw</button></article></section><section className="content-section"><h2>Pending withdrawals</h2>{withdrawals.length === 0 ? <p className="rules-intro">No pending withdrawals.</p> : withdrawals.map((item) => <article className="step-card" style={{ marginBottom: 10 }} key={item.id}><h3>#{item.id} Â· {item.token_amount} LLT</h3><p>{item.wallet_address}</p><div className="hero-actions"><button className="button button-small" onClick={() => action(`/api/admin/withdrawals/${item.id}/approve`, 'Withdrawal approved and sent.')}>Approve</button><button className="button button-secondary button-small" onClick={() => action(`/api/admin/withdrawals/${item.id}/reject`, 'Withdrawal rejected and coins refunded.')}>Reject</button></div></article>)}</section><section className="content-section"><h2>Recent users</h2><div className="rules-list">{users.slice(0, 20).map((user) => <article key={user.id}><b>#{user.id}</b><div><h2>{user.username || 'Unnamed user'}</h2><p>{user.coins} coins Â· {user.referral_count} referrals Â· {user.is_banned ? 'Banned' : 'Active'}</p></div></article>)}</div></section></main>;
}



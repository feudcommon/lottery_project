import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import PageShell from '../components/PageShell';

const FAQS = [
  { q: 'Can I play without Telegram?', a: 'Sign-in currently goes through Telegram — you can open the site directly, but you\'ll still connect using your Telegram account to log in.' },
  { q: 'What happens if I have 0 coins?', a: 'You can claim your free daily coin, earn more through referrals, or buy coins directly from your profile to keep playing.' },
  { q: 'How is the winner chosen?', a: 'A random seed is committed (its hash published) before ticket sales close, then revealed at draw time. Anyone can check the revealed seed against the published hash.' },
  { q: 'How do withdrawals work?', a: 'Once you meet the minimum coin balance and referral count, you can request a withdrawal, which converts coins to tokens and sends them to your connected wallet.' },
  { q: 'Is the smart contract audited?', a: 'Yes — by EtherAuthority. The audit badge on the homepage links to the published report.' },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <PageShell eyebrow="FAQ" title="Common questions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FAQS.map((f, i) => {
          const open = openIdx === i;
          return (
            <div key={i} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenIdx(open ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer',
                  padding: '14px 16px', color: '#fff', fontSize: 14, fontWeight: 600, textAlign: 'left',
                }}
              >
                {f.q}
                <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, marginLeft: 12 }} />
              </button>
              {open && <div style={{ padding: '0 16px 16px' }}>{f.a}</div>}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
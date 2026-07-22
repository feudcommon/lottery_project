import PageShell from '../components/PageShell';

const STEPS = [
  { title: 'Connect with Telegram', body: 'Sign in through your Telegram account — the same login works on web and inside the Telegram Mini App.' },
  { title: 'Earn or buy coins', body: 'Claim a free daily coin, refer friends for bonus coins, or top up directly if you want to jump straight in.' },
  { title: 'Buy a ticket', body: 'Each draw day has a limited number of ticket slots. Pick one before the sales window closes.' },
  { title: 'Watch the draw settle', body: 'A random seed is committed before sales close and revealed at draw time, so the result can be verified by anyone.' },
  { title: 'Withdraw your winnings', body: 'Once you meet the minimum coin and referral thresholds, convert coins to tokens and withdraw to your wallet.' },
];

export default function HowItWorks() {
  return (
    <PageShell eyebrow="How It Works" title="From sign-in to withdrawal">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 16 }}>
            <div style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(232,121,249,0.12)', border: '1px solid rgba(232,121,249,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#e879f9',
            }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{s.title}</div>
              <div>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
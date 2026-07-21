import { Link } from 'react-router-dom';
import { Award, Clock3, Coins, ExternalLink, ShieldCheck, Ticket, Trophy, Users } from 'lucide-react';

const stats = [
  { label: 'Current jackpot', value: '10,000 LLT', icon: Trophy },
  { label: 'Next draw', value: 'Daily at 18:00', icon: Clock3 },
  { label: 'Ticket pool', value: '50 tickets', icon: Ticket },
  { label: 'Prize pool', value: 'Community funded', icon: Coins },
];

export default function Landing() {
  return <main className="site-shell">
    <nav className="site-nav" aria-label="Main navigation">
      <Link className="brand" to="/">SCAI <span>Lucky Loop</span></Link>
      <div className="nav-links"><a href="#about">About</a><a href="#how-it-works">How it works</a><Link to="/rules">Game rules</Link><a href="#faq">FAQ</a><a href="#contact">Contact</a></div>
      <Link className="button button-small" to="/login">Play now</Link>
    </nav>

    <section className="hero">
      <div>
        <p className="eyebrow">ON-CHAIN DAILY LOTTERY</p>
        <h1>Every day is your <span>lucky loop.</span></h1>
        <p className="hero-copy">Earn coins, choose a ticket, and take part in a transparent daily draw. Play from Telegram or directly on the web.</p>
        <div className="hero-actions"><Link className="button" to="/login">Play with Telegram</Link><a className="button button-secondary" href="#how-it-works">How it works</a></div>
        <div className="trust-row"><span><ShieldCheck size={16}/> Commit-reveal draws</span><span><Users size={16}/> Telegram + website</span></div>
      </div>
      <div className="jackpot-art" aria-label="Lottery jackpot illustration">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <div className="ticket-art">LLT<br/><small>DAILY DRAW</small></div>
        <div className="jackpot-badge"><Trophy size={18}/><div><small>LIVE JACKPOT</small><strong>10,000 LLT</strong></div></div>
        <div className="telegram-preview"><span>âœˆ</span><div><small>Telegram Mini App</small><strong>Ready to play</strong></div></div>
      </div>
    </section>

    <section className="stat-grid" aria-label="Game statistics">{stats.map(({ label, value, icon: Icon }) => <article className="stat-card" key={label}><Icon size={20}/><div><small>{label}</small><strong>{value}</strong></div></article>)}</section>

    <section id="how-it-works" className="content-section"><p className="eyebrow">SIMPLE AND TRANSPARENT</p><h2>How it works</h2><div className="step-grid">
      {[['1','Earn daily coins','Claim a daily reward and invite friends to grow your balance.'],['2','Choose tickets','Spend 10 coins per ticket. If your balance is zero, earn coins first or use the Buy Coins option.'],['3','Verify the draw','A commit-reveal seed selects the winner and public results can be checked by anyone.']].map(([number,title,text]) => <article className="step-card" key={number}><b>{number}</b><h3>{title}</h3><p>{text}</p></article>)}
    </div></section>

    <section id="about" className="feature-panel"><div><p className="eyebrow">BUILT FOR TRUST</p><h2>Fair draws, clear rewards.</h2><p>Tickets, outcomes and withdrawal requests are recorded by the platform. Eligible winnings are credited as coins, then can be converted to LLT tokens using a connected SCAI wallet.</p><Link to="/rules" className="text-link">Read the complete rules <ExternalLink size={15}/></Link></div><div className="feature-list"><span><ShieldCheck/> On-chain withdrawal support</span><span><Award/> Public fairness verification</span><span><Coins/> Daily coins and referral rewards</span></div></section>

    <section id="faq" className="content-section faq"><h2>Questions, answered</h2><details><summary>Can I play on the website?</summary><p>Yes. The same React application runs in a browser and as a Telegram Mini App. Telegram authentication is required before tickets can be bought.</p></details><details><summary>What happens when I have 0 coins?</summary><p>You cannot buy a ticket until you have enough coins. Claim the daily reward, use referrals, or select Buy Coins when it is available for your account.</p></details><details><summary>How are winnings withdrawn?</summary><p>Winning coins appear in your balance. After you meet the minimum coin and referral requirements, submit a withdrawal address. The request is validated and paid as LLT on SCAI Mainnet.</p></details></section>

    <footer id="contact" className="site-footer"><span>Â© 2026 SCAI Lucky Loop</span><span>Network: SCAI Mainnet Â· Contract: 0x2904â€¦330a2</span><Link to="/rules">Game Rules</Link></footer>
  </main>;
}



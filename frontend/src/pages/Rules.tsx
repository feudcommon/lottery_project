import { Link } from 'react-router-dom';

const rules = [
  ['Eligibility and access', 'Play using a verified Telegram account. The same rules apply whether you open Lucky Loop in Telegram or from the website.'],
  ['Coins and tickets', 'Tickets cost 10 in-app coins. A player may buy up to the configured daily limit (normally two), only while ticket sales are open. A zero balance cannot purchase tickets.'],
  ['Winner selection', 'Before a draw, the server publishes a hash of a secret seed. After sales close, it reveals the seed and uses it to select a ticket. Anyone can inspect the draw verification endpoint.'],
  ['Rewards', 'The winning reward is credited to the winnerâ€™s coin balance and appears in account history. Reward size follows the draw configuration and prize pool.'],
  ['Withdrawals', 'Once the account meets the minimum coins and referrals, the player submits a valid SCAI-compatible wallet address. A successful approved request converts coins to LLT and records a transaction hash.'],
  ['Fair play', 'Automated, duplicate, fraudulent, or abusive activity may be rate-limited or banned. Ticket purchases and withdrawals are validated server-side.'],
];

export default function Rules() { return <main className="rules-page"><header><Link className="brand" to="/">SCAI <span>Lucky Loop</span></Link><Link className="button button-small" to="/login">Play now</Link></header><p className="eyebrow">ONE SET OF RULES, EVERY PLATFORM</p><h1>Game Rules</h1><p className="rules-intro">These rules are shown in the website and Telegram Mini App before play begins.</p><div className="rules-list">{rules.map(([title, body], index) => <article key={title}><b>{String(index + 1).padStart(2, '0')}</b><div><h2>{title}</h2><p>{body}</p></div></article>)}</div><footer><Link to="/">Back to home</Link> Â· <a href="mailto:support@scai.lucky">Contact support</a></footer></main>; }



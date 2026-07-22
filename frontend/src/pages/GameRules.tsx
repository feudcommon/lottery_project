import PageShell from '../components/PageShell';

export default function GameRules() {
  return (
    <PageShell eyebrow="Game Rules" title="Official lottery rules">
      <p style={{ marginBottom: 16 }}>
        These rules apply identically whether you're playing on the website
        or inside the Telegram Mini App.
      </p>
      <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <li>Each draw day has a fixed number of ticket slots; once sold out, no further tickets are available for that draw.</li>
        <li>Each player may purchase a limited number of tickets per day, regardless of coin balance.</li>
        <li>Ticket sales are only open during the published sales window; purchases outside that window are rejected.</li>
        <li>The winning ticket is selected using a server seed committed (hashed) before the draw and revealed afterward, so results can be independently verified.</li>
        <li>Winnings are credited as coins immediately after the draw. Coins can later be converted to on-chain tokens and withdrawn.</li>
        <li>Accounts flagged for abuse (multi-accounting, exploiting the free-coin system) may be suspended, which blocks further ticket purchases and withdrawals.</li>
      </ul>
    </PageShell>
  );
}
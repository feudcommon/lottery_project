import PageShell from '../components/PageShell';

export default function About() {
  return (
    <PageShell eyebrow="About" title="Built on transparency, run on SCAI">
      <p style={{ marginBottom: 16 }}>
        SCAI Lucky Loop is a daily lottery game running natively on the SCAI
        network. Every draw uses a commit-reveal random seed published before
        tickets close, so anyone can verify a result was never chosen after
        the fact.
      </p>
      <p style={{ marginBottom: 16 }}>
        Players earn free coins daily, spend them on tickets, and can convert
        winnings back into on-chain tokens whenever they choose — no lockups,
        no waiting periods beyond standard withdrawal processing.
      </p>
      <p>
        The project's smart contract has been reviewed by EtherAuthority; the
        audit badge on our homepage links to that report.
      </p>
    </PageShell>
  );
}
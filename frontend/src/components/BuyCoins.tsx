import { useState, type FormEvent } from 'react';
import { useDeposit } from '../hooks/useDeposit';

type BuyCoinsProps = {
  walletAddress: string;
  onSuccess?: () => void;
};

export default function BuyCoins({ walletAddress, onSuccess }: BuyCoinsProps) {
  const { buyCoinsWithScai, isLoading, error } = useDeposit();
  const [amountScai, setAmountScai] = useState('');
  const [result, setResult] = useState<{ coinsCredited: number } | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!walletAddress) return;

    try {
      const data = await buyCoinsWithScai(Number(amountScai));
      setResult({ coinsCredited: data.coinsCredited });
      setAmountScai('');
      onSuccess?.();
    } catch (err) {
      console.error('Buy coins failed:', err);
    }
  };

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(52, 211, 153, 0.35)',
        borderRadius: '16px',
        padding: '1.25rem',
      }}
    >
      <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 0.5rem', color: '#34d399' }}>
        Buy coins with SCAI
      </h2>

      <p style={{ fontSize: '12px', color: '#a0aec0', lineHeight: 1.5, margin: '0 0 1rem' }}>
        Send SCAI from your connected wallet to receive coins. Requires a
        connected wallet on the SCAI network.
      </p>

      {!walletAddress ? (
        <p style={{ fontSize: '12px', color: '#fbbf24', margin: 0 }}>
          Connect a wallet above to buy coins.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="number"
            step="any"
            min="0"
            value={amountScai}
            onChange={(event) => setAmountScai(event.target.value)}
            placeholder="Amount in SCAI"
            required
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(52, 211, 153, 0.2)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !amountScai}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #059669, #34d399)',
              border: 'none',
              color: '#fff',
              borderRadius: '100px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              opacity: isLoading || !amountScai ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isLoading ? 'Processing...' : 'Buy'}
          </button>
        </form>
      )}

      {error && <div style={{ marginTop: '0.75rem', fontSize: '12px', color: '#fca5a5' }}>{error}</div>}

      {result && (
        <div style={{ marginTop: '0.75rem', fontSize: '12px', color: '#34d399' }}>
          +{result.coinsCredited} coins credited!
        </div>
      )}
    </div>
  );
}
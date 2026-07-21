import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift } from 'lucide-react';
import { useBalance } from '../hooks/useBalance';
import { useWithdraw } from '../hooks/useWithdraw';
import WalletConnect from '../components/WalletConnect';
import BuyCoins from '../components/BuyCoins';
import api from '../api/client';

export default function Withdraw() {
  const navigate = useNavigate();
  const { coins } = useBalance();
  const { requestWithdrawal, isLoading, error } = useWithdraw();

  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [eligibility, setEligibility] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [withdrawalResult, setWithdrawalResult] = useState<any>(null);

  useEffect(() => {
    api
      .get('/api/withdraw/eligibility')
      .then((res) => setEligibility(res.data))
      .catch((err) => console.error('Failed to fetch eligibility:', err));
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    try {
      const result = await requestWithdrawal(
        walletAddress,
        Number(amount)
      );

      setWithdrawalResult(result.withdrawal);
      setSubmitted(true);
      setAmount('');
    } catch (err) {
      console.error('Withdrawal request failed:', err);
    }
  };

  const minCoins = eligibility?.minCoins ?? 0;
  const referralCount = eligibility?.referralCount ?? 0;
  const referralBonus = referralCount >= 5 ? 100 : 0;
  const isEligible = eligibility?.eligible ?? false;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #07050f 0%, #1a0f2e 100%)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        paddingBottom: '2rem',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 80% 60% at 20% 30%, #3b0764bb 0%, transparent 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 60% 50% at 80% 60%, #831843aa 0%, transparent 60%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '1.5rem',
          maxWidth: '600px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(232, 121, 249, 0.1)',
              border: '1px solid rgba(232, 121, 249, 0.3)',
              color: '#fff',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={20} />
          </button>

          <h1
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              background: 'linear-gradient(90deg, #e879f9, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
            }}
          >
            Withdraw LLT
          </h1>
        </div>

        {!eligibility ? (
          <div
            style={{
              textAlign: 'center',
              color: '#a0aec0',
              padding: '2rem',
            }}
          >
            Loading eligibility...
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Multi-wallet connection: MetaMask, Trust Wallet, WalletConnect, etc. */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(246, 133, 27, 0.4)',
                borderRadius: '16px',
                padding: '1.25rem',
              }}
            >
              <h2
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  margin: '0 0 0.5rem',
                  color: '#fbbf24',
                }}
              >
                Connect wallet
              </h2>

              <p
                style={{
                  fontSize: '12px',
                  color: '#a0aec0',
                  lineHeight: 1.5,
                  margin: '0 0 1rem',
                }}
              >
                Connect MetaMask, Trust Wallet, Coinbase Wallet, or another
                compatible wallet. The selected address is used for LLT
                withdrawals.
              </p>

              <WalletConnect onAddress={setWalletAddress} />
            </div>
            <BuyCoins walletAddress={walletAddress} />

            {/* Eligibility */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(232, 121, 249, 0.15)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 0 40px rgba(192, 38, 211, 0.1)',
              }}
            >
              <h2
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#e879f9',
                  margin: '0 0 1rem',
                }}
              >
                Requirements
              </h2>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', color: '#a0aec0' }}>
                      Minimum Coins
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      {coins} / {minCoins}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: isEligible ? '#34d399' : '#fca5a5',
                    }}
                  >
                    {isEligible ? '✓' : '✕'}
                  </div>
                </div>

                <div
                  style={{
                    height: '1px',
                    background: 'rgba(148, 163, 184, 0.1)',
                  }}
                />

                <div
                  style={{
                    background:
                      referralBonus > 0
                        ? 'rgba(34, 197, 94, 0.05)'
                        : 'rgba(107, 114, 128, 0.05)',
                    border: `1px solid ${
                      referralBonus > 0
                        ? 'rgba(34, 197, 94, 0.2)'
                        : 'rgba(107, 114, 128, 0.2)'
                    }`,
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <Gift
                    size={18}
                    style={{
                      color: referralBonus > 0 ? '#22c55e' : '#6b7280',
                      flexShrink: 0,
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#a0aec0' }}>
                      Referrals
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: referralBonus > 0 ? '#22c55e' : '#a0aec0',
                      }}
                    >
                      {referralCount} / 5
                      {referralBonus > 0 &&
                        ` • +${referralBonus} coins bonus`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isEligible ? (
              submitted ? (
                <div
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '24px',
                      marginBottom: '0.5rem',
                    }}
                  >
                    ✓
                  </div>

                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#34d399',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Withdrawal Complete!
                  </div>

                  <div
                    style={{
                      fontSize: '12px',
                      color: '#a0aec0',
                      marginBottom: '1rem',
                    }}
                  >
                    {withdrawalResult?.tokenAmount} LLT sent to your wallet
                  </div>

                  {withdrawalResult?.explorerUrl && (
                    <a
                      href={withdrawalResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '13px',
                        color: '#e879f9',
                        textDecoration: 'underline',
                        wordBreak: 'break-all',
                      }}
                    >
                      View transaction on Explorer ↗
                    </a>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(232, 121, 249, 0.15)',
                      borderRadius: '16px',
                      padding: '1.5rem',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#e879f9',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '0.75rem',
                      }}
                    >
                      Wallet Address
                    </label>

                    <input
                      type="text"
                      value={walletAddress}
                      onChange={(event) => setWalletAddress(event.target.value)}
                      placeholder="Connect a wallet or enter 0x..."
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(232, 121, 249, 0.2)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(232, 121, 249, 0.15)',
                      borderRadius: '16px',
                      padding: '1.5rem',
                    }}
                  >
                    <label
                      style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#e879f9',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '0.75rem',
                      }}
                    >
                      Amount (coins)
                    </label>

                    <input
                      type="number"
                      value={amount}
                      min="1"
                      max={coins}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(232, 121, 249, 0.2)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />

                    <div
                      style={{
                        fontSize: '11px',
                        color: '#a0aec0',
                        marginTop: '0.5rem',
                      }}
                    >
                      Available: {coins} coins
                    </div>
                  </div>

                  {error && (
                    <div
                      style={{
                        background: 'rgba(220, 38, 38, 0.1)',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '14px',
                        color: '#fca5a5',
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !walletAddress || !amount}
                    style={{
                      width: '100%',
                      padding: '13px',
                      background: 'linear-gradient(135deg, #7c3aed, #c026d3)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '100px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      opacity:
                        isLoading || !walletAddress || !amount ? 0.5 : 1,
                    }}
                  >
                    {isLoading ? 'Processing...' : 'Request Withdrawal'}
                  </button>
                </form>
              )
            ) : (
              <div
                style={{
                  background: 'rgba(217, 119, 6, 0.1)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#f59e0b',
                    marginBottom: '0.75rem',
                  }}
                >
                  Not Quite There Yet
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: '#a0aec0',
                    lineHeight: 1.8,
                  }}
                >
                  {coins >= minCoins ? '✓' : '✕'} Coins: {coins} / {minCoins}
                  <br />
                  {referralCount >= 5 ? '✓' : '✕'} Referrals: {referralCount}{' '}
                  / 5
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
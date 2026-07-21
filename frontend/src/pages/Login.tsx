import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/userStore';
import { Link } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const { token } = useUserStore();
  const { loginWithTelegram, isLoading, error } = useAuth();

  useEffect(() => {
    if (token) navigate('/home', { replace: true });
  }, [navigate, token]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#07050f',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '2.5rem 2.5rem 2rem',
      fontFamily: 'sans-serif',
    }}>

      {/* Smoke layers */}
      <div style={{ position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(ellipse 80% 60% at 20% 30%, #3b0764bb 0%, transparent 65%)' }} />
      <div style={{ position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(ellipse 60% 50% at 80% 60%, #831843aa 0%, transparent 60%)' }} />
      <div style={{ position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(ellipse 50% 40% at 50% 0%, #1e1b4b66 0%, transparent 70%)' }} />

      {/* Noise texture */}
      <div style={{
        position:'absolute',inset:0,pointerEvents:'none',opacity:0.045,
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize:'200px',
      }} />

      {/* Deco circles */}
      <div style={{ position:'absolute',width:400,height:400,top:-100,right:-100,borderRadius:'50%',border:'1px solid rgba(232,121,249,0.06)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',width:240,height:240,top:-20,right:-20,borderRadius:'50%',border:'1px solid rgba(232,121,249,0.05)',pointerEvents:'none' }} />
      <div style={{ position:'absolute',width:600,height:600,bottom:-300,left:-200,borderRadius:'50%',border:'1px solid rgba(167,139,250,0.04)',pointerEvents:'none' }} />

      {/* Ghost title */}
      <div style={{
        position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        fontSize:72,fontWeight:800,color:'rgba(255,255,255,0.04)',
        letterSpacing:'0.08em',whiteSpace:'nowrap',pointerEvents:'none',
        textTransform:'uppercase',userSelect:'none',
      }}>LUCKY</div>

      {/* Top left accent */}
      <div style={{ position:'absolute',top:'2.5rem',left:'2.5rem',width:2,height:60,background:'linear-gradient(to bottom, #e879f9, transparent)' }} />
      <div style={{ position:'absolute',top:'2.5rem',left:'calc(2.5rem + 16px)',fontSize:10,letterSpacing:'0.18em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)' }}>
        SCAI Network - 2026
      </div>

      {/* Top right tag */}
      <div style={{
        position:'absolute',top:'2.5rem',right:'2.5rem',fontSize:10,
        letterSpacing:'0.12em',color:'rgba(255,255,255,0.2)',textTransform:'uppercase',
        border:'1px solid rgba(255,255,255,0.1)',padding:'4px 10px',borderRadius:100,
      }}>Telegram Mini App</div>

      {/* Main content */}
      <div style={{ position:'relative', zIndex:2 }}>
        <Link to="/rules" style={{ color:'#f0abfc', fontSize:12, textDecoration:'none', display:'inline-block', marginBottom:18 }}>Read Game Rules â†’</Link>

        {/* Eyebrow */}
        <div style={{ fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:'#e879f9',marginBottom:'0.5rem',display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ display:'inline-block',width:24,height:1,background:'#e879f9' }} />
          Daily Lottery
        </div>

        {/* Title */}
        <div style={{ fontSize:52,fontWeight:800,lineHeight:1,color:'#fff',letterSpacing:'-0.02em',marginBottom:'0.25rem' }}>
          SCAI<br />
          <span style={{ background:'linear-gradient(90deg,#e879f9,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text' }}>
            Lucky Loop
          </span>
        </div>

        <div style={{ fontSize:13,color:'rgba(255,255,255,0.3)',letterSpacing:'0.05em',marginBottom:'1.5rem' }}>
          Verified randomness - Real rewards - Every day
        </div>

        {/* Audit badge */}
        <div style={{
          display:'inline-flex',alignItems:'center',gap:7,marginBottom:'1.25rem',
          background:'rgba(255,255,255,0.03)',border:'1px solid rgba(52,211,153,0.25)',
          borderRadius:100,padding:'5px 12px 5px 6px',
        }}>
          <div style={{ width:20,height:20,borderRadius:'50%',background:'linear-gradient(135deg,#059669,#34d399)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,flexShrink:0,color:'white',fontWeight:'bold' }}>
            A
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:1 }}>
            <div style={{ fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:'0.08em',textTransform:'uppercase',lineHeight:1 }}>
              Smart contract audited by
            </div>
            <div style={{ fontSize:11,fontWeight:600,color:'#34d399',letterSpacing:'0.03em',lineHeight:1.2 }}>
              EtherAuthority
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ borderRadius:12,padding:'10px 14px',marginBottom:16,fontSize:13,background:'rgba(220,38,38,0.15)',border:'1px solid rgba(220,38,38,0.3)',color:'#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Button */}
        <button
          onClick={loginWithTelegram}
          disabled={isLoading}
          style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'13px 24px',
            border:'none',borderRadius:100,
            background:'linear-gradient(135deg,#7c3aed,#c026d3)',
            color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
            letterSpacing:'0.03em',whiteSpace:'nowrap',
            boxShadow:'0 0 30px rgba(192,38,211,0.35)',
            marginBottom:'1.75rem',opacity: isLoading ? 0.5 : 1,
          }}>
          {isLoading ? 'Connecting...' : 'Connect with Telegram'}
        </button>

        {/* Bottom row */}
        <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:16 }}>

          {/* Stats */}
          <div style={{ display:'flex',gap:20,alignItems:'flex-end' }}>
            {[
              { num: '1', label: 'Free coin daily' },
              { num: '10', label: 'Coins per ticket' },
              { num: 'Infinity', label: 'Withdrawals' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize:18,fontWeight:700,color:'#fff',lineHeight:1 }}>{s.num}</div>
                <div style={{ fontSize:9,color:'rgba(255,255,255,0.25)',textTransform:'uppercase',letterSpacing:'0.1em',marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pills */}
          <div style={{ display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',flexShrink:0 }}>
            {['On-chain verified draw','Earn daily coins','Withdraw anytime'].map((p, i) => (
              <div key={i} style={{ fontSize:10,color:'rgba(255,255,255,0.4)',border:'1px solid rgba(255,255,255,0.08)',padding:'4px 12px',borderRadius:100,whiteSpace:'nowrap',letterSpacing:'0.05em' }}>
                {p}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}



import { useState } from 'react';
import { useBalance } from '../hooks/useBalance';
import api from '../api/client';

export default function Home() {
  const { coins, refetch } = useBalance();
  const [spinLoading, setSpinLoading] = useState(false);
  const [spinMessage, setSpinMessage] = useState<string | null>(null);

  const handleSpin = async () => {
    setSpinLoading(true);
    setSpinMessage(null);
    try {
      const result = await api.post('/api/spin');
      setSpinMessage(`+${result.data.reward} coins!`);
      refetch();
    } catch (error: any) {
      setSpinMessage(error.response?.data?.error || 'Spin failed');
    } finally {
      setSpinLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#07050f',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'sans-serif',
      color: '#fff',
    }}>

      {/* Background smoke */}
      <div style={{ position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(ellipse 80% 60% at 20% 30%, #3b0764bb 0%, transparent 65%)' }} />
      <div style={{ position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(ellipse 60% 50% at 80% 60%, #831843aa 0%, transparent 60%)' }} />

      {/* Ghost text */}
      <div style={{
        position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        fontSize:80,fontWeight:800,color:'rgba(255,255,255,0.03)',
        letterSpacing:'0.08em',whiteSpace:'nowrap',pointerEvents:'none',
        textTransform:'uppercase',userSelect:'none',
      }}>LUCKY</div>

      {/* Content */}
      <div style={{ position:'relative',zIndex:2,padding:'2rem 1.5rem' }}>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'2rem' }}>
          <div>
            <div style={{ fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#e879f9',marginBottom:4,display:'flex',alignItems:'center',gap:6 }}>
              <span style={{ display:'inline-block',width:16,height:1,background:'#e879f9' }} />
              Daily Lottery
            </div>
            <div style={{ fontSize:22,fontWeight:800,letterSpacing:'-0.02em' }}>
              SCAI <span style={{ background:'linear-gradient(90deg,#e879f9,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text' }}>Lucky Loop</span>
            </div>
          </div>
          <div style={{ fontSize:10,letterSpacing:'0.12em',color:'rgba(255,255,255,0.2)',textTransform:'uppercase',border:'1px solid rgba(255,255,255,0.1)',padding:'4px 10px',borderRadius:100 }}>
            Mini App
          </div>
        </div>

        {/* Balance card */}
        <div style={{
          background:'rgba(255,255,255,0.04)',border:'1px solid rgba(232,121,249,0.15)',
          borderRadius:20,padding:'1.5rem',marginBottom:'1rem',
          boxShadow:'0 0 40px rgba(192,38,211,0.1)',
        }}>
          <div style={{ fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)',marginBottom:6 }}>Your Balance</div>
          <div style={{ fontSize:42,fontWeight:800,letterSpacing:'-0.02em',background:'linear-gradient(90deg,#e879f9,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text' }}>
            {coins}
          </div>
          <div style={{ fontSize:12,color:'rgba(255,255,255,0.25)',marginTop:2 }}>coins</div>
        </div>

        {/* Spin card */}
        <div style={{
          background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:20,padding:'1.5rem',marginBottom:'1rem',
        }}>
          <div style={{ fontSize:14,fontWeight:700,marginBottom:4 }}>Daily Spin</div>
          <div style={{ fontSize:12,color:'rgba(255,255,255,0.3)',marginBottom:'1rem' }}>Claim free coins once per day</div>

          {spinMessage && (
            <div style={{
              borderRadius:10,padding:'8px 12px',marginBottom:12,fontSize:13,
import PageShell from '../components/PageShell';
import { Send, Mail } from 'lucide-react';

export default function Contact() {
  return (
    <PageShell eyebrow="Contact" title="Get in touch">
      <p style={{ marginBottom: 24 }}>
        For support, partnership inquiries, or anything else, reach us through either channel below.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
        <a
          href="https://t.me/ScaiLuckyLoop_bot"
          target="_blank" rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
            background: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.2)',
            borderRadius: 14, padding: '14px 16px', color: '#fff',
          }}
        >
          <Send size={16} color="#29b6f6" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Telegram</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>@ScaiLuckyLoop_bot</div>
          </div>
        </a>
        <a
          href="mailto:nsiripurapu20@gmail.com"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '14px 16px', color: '#fff',
          }}
        >
          <Mail size={16} color="#e879f9" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Email</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>nsiripurapu20@gmail.com</div>
          </div>
        </a>
      </div>
    </PageShell>
  );
}
import { ReactNode } from 'react';
import Navbar from './Navbar';

// Shared wrapper for the lightweight public pages (About, How It Works,
// Game Rules, FAQ, Contact) so they share the nav bar and background
// treatment with the landing page instead of looking like a different app.
export default function PageShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#07050f', fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '3.5rem 1.5rem 5rem' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#e879f9', marginBottom: '0.75rem' }}>
          {eyebrow}
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(30px,4vw,42px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: '0 0 2rem' }}>
          {title}
        </h1>
        <div style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.65)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
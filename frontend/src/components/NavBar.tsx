import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { label: 'About', to: '/about' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Game Rules', to: '/rules' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact', to: '/contact' },
];

// Public-site nav bar. Sits above Login and the informational pages
// (About / How It Works / Game Rules / FAQ / Contact). Not shown on the
// in-app (post-login) routes, which have their own bottom tab nav.
export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(7,5,15,0.75)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0.9rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'conic-gradient(from 200deg, #e879f9, #a78bfa, #7c3aed, #e879f9)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}
          >
            Lucky Loop
          </span>
        </Link>

        {/* Desktop links */}
        <nav
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
          className="navbar-links"
        >
          {LINKS.map((l) => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: '7px 13px',
                  borderRadius: 100,
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  background: active ? 'rgba(232,121,249,0.12)' : 'transparent',
                  border: active ? '1px solid rgba(232,121,249,0.25)' : '1px solid transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            to="/login"
            style={{
              marginLeft: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              padding: '8px 18px',
              borderRadius: 100,
              color: '#fff',
              background: 'linear-gradient(135deg,#7c3aed,#c026d3)',
              boxShadow: '0 0 20px rgba(192,38,211,0.3)',
            }}
          >
            Play Now
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="navbar-toggle"
          style={{
            display: 'none',
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 6,
          }}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '0.75rem 1.5rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              style={{
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                color: 'rgba(255,255,255,0.75)',
                padding: '10px 4px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/login"
            onClick={() => setOpen(false)}
            style={{
              marginTop: 10,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              textAlign: 'center',
              padding: '11px 18px',
              borderRadius: 100,
              color: '#fff',
              background: 'linear-gradient(135deg,#7c3aed,#c026d3)',
            }}
          >
            Play Now
          </Link>
        </div>
      )}

      <style>{`
        @media (max-width: 780px) {
          .navbar-links { display: none !important; }
          .navbar-toggle { display: block !important; }
        }
      `}</style>
    </header>
  );
}
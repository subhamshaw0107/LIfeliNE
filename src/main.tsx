import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('LIFELINE App Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#07090E',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🛡️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', color: '#EF4444' }}>
            LIFELINE RESCUE
          </h2>
          <p style={{ fontSize: '13px', color: '#94A3B8', maxWidth: '320px', marginBottom: '24px', lineHeight: 1.5 }}>
            Application refreshed. Tap below to reload the emergency interface.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
            }}
          >
            Reload LIFELINE
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register service worker for offline disaster operation & Android WebAPK install
// Uses import.meta.env.BASE_URL so it works under any deployment subpath
// (root / for Vercel, /LIfeliNE/ for GitHub Pages, etc.)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = (import.meta.env.BASE_URL || '/') + 'sw.js';
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL || '/' }).catch(() => {
      // Service worker registration failed - app still works without offline caching
    });
  });
}


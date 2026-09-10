import React, { useState } from 'react';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Props {
  onBackToLogin: () => void;
}

export const ForgotPasswordModal: React.FC<Props> = ({ onBackToLogin }) => {
  const [identifier, setIdentifier] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [simulatedCode, setSimulatedCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    // Generate simulated recovery token
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedCode(code);
    setIsSubmitted(true);
  };

  return (
    <div className="auth-card-wrapper">
      <div className="auth-glass-card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.1))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)'
            }}
          >
            <KeyRound size={26} color="#38BDF8" />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFF', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>
            RESET PASSWORD
          </h2>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
            Enter your registered Phone Number or Email to generate an offline emergency cryptographic recovery token.
          </p>
        </div>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 6, display: 'block' }}>
                Phone Number or Email
              </label>
              <div className="auth-input-container">
                <Mail size={16} color="#64748B" />
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="e.g. +91 98765 43210 or user@mesh.net"
                  className="auth-text-input"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-primary-btn">
              SEND RESET CODE
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="auth-text-btn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}
            >
              <ArrowLeft size={14} />
              <span>Back to Login</span>
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 12,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8
              }}
            >
              <CheckCircle2 size={32} color="#10B981" />
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF' }}>
                RECOVERY CODE GENERATED
              </div>
              <div style={{ fontSize: 12, color: '#CBD5E1' }}>
                Offline recovery token for <strong style={{ color: '#38BDF8' }}>{identifier}</strong>:
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '4px',
                  color: '#10B981',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '6px 18px',
                  borderRadius: 8,
                  border: '1px dashed rgba(16, 185, 129, 0.4)'
                }}
              >
                {simulatedCode}
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
                This cryptographic token has been queued to forward across local Bluetooth mesh relays.
              </p>
            </div>

            <button
              type="button"
              onClick={onBackToLogin}
              className="auth-primary-btn"
              style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)' }}
            >
              RETURN TO LOGIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

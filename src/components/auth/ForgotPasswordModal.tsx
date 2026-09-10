import React, { useState } from 'react';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { resetPasswordWithFirebase, formatFirebaseAuthError, isFirebaseConfigured } from '../../services/firebase';

interface Props {
  onBackToLogin: () => void;
}

export const ForgotPasswordModal: React.FC<Props> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!isFirebaseConfigured()) {
      setErrorMessage('Firebase Authentication is not configured. Please check `.env.local`.');
      return;
    }

    setIsLoading(true);

    try {
      await resetPasswordWithFirebase(cleanEmail);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('[LIFELINE Password Reset Error]', err);
      const friendlyMsg = formatFirebaseAuthError(err);
      setErrorMessage(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
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

          <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>
            RESET PASSWORD
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-sub)', margin: 0, lineHeight: 1.5 }}>
            Enter your registered account email. Firebase will send a secure password reset link to your inbox.
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              padding: '10px 12px',
              color: '#DC2626',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginBottom: 12
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6, display: 'block' }}>
                Registered Email Address
              </label>
              <div className="auth-input-container">
                <Mail size={16} color="#64748B" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="auth-text-input"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-primary-btn"
              disabled={isLoading}
              style={{
                opacity: isLoading ? 0.75 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <span>SEND RESET EMAIL</span>
              )}
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="auth-text-btn"
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, cursor: 'pointer' }}
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
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10
              }}
            >
              <CheckCircle2 size={36} color="#10B981" />
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
                PASSWORD RESET EMAIL SENT
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
                A password reset link has been dispatched to{' '}
                <strong style={{ color: 'var(--text-main)' }}>{email}</strong> via Firebase Authentication.
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-sub)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Please check your inbox (and spam folder) to reset your password, then return here to log in.
              </p>
            </div>

            <button
              type="button"
              onClick={onBackToLogin}
              className="auth-primary-btn"
              style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', cursor: 'pointer' }}
            >
              RETURN TO LOGIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

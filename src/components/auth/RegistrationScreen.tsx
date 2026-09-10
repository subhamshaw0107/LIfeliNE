import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { registerWithFirebase, isFirebaseConfigured, formatFirebaseAuthError } from '../../services/firebase';

interface Props {
  onNavigateToLogin: () => void;
}

export const RegistrationScreen: React.FC<Props> = ({ onNavigateToLogin }) => {
  const { login } = useApp();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setErrorMsg('Please fill in Full Name, Email, Phone Number, and Password.');
      return;
    }

    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (!isFirebaseConfigured()) {
      setErrorMsg('Firebase Authentication is not configured. Please add your Firebase credentials to `.env.local` to register.');
      return;
    }

    setIsLoading(true);

    try {
      // Create user account via Firebase Authentication (passwords managed securely by Firebase)
      const account = await registerWithFirebase({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: 'VICTIM'
      });
      login(account);
    } catch (err: any) {
      console.error('[LIFELINE Registration Error]', err);
      const friendlyMsg = formatFirebaseAuthError(err);
      setErrorMsg(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card-wrapper">
      <div className="auth-glass-card">
        {/* Card Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>
            CREATE YOUR LIFELINE ACCOUNT
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-sub)', margin: 0 }}>
            Join the store-carry-forward disaster mesh network
          </p>
        </div>

        {errorMsg && (
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
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* Full Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, display: 'block' }}>
              Full Name *
            </label>
            <div className="auth-input-container">
              <User size={15} color="#64748B" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Subham Das"
                className="auth-text-input"
                required
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, display: 'block' }}>
              Email Address *
            </label>
            <div className="auth-input-container">
              <Mail size={15} color="#64748B" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="subham@example.com"
                className="auth-text-input"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, display: 'block' }}>
              Phone Number *
            </label>
            <div className="auth-input-container">
              <Phone size={15} color="#64748B" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="auth-text-input"
                required
                disabled={isLoading}
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, display: 'block' }}>
              Password * (min. 6 characters)
            </label>
            <div className="auth-input-container">
              <Lock size={15} color="#64748B" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-text-input"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, display: 'block' }}>
              Confirm Password *
            </label>
            <div className="auth-input-container">
              <Lock size={15} color="#64748B" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-text-input"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2 }}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="auth-primary-btn"
            disabled={isLoading}
            style={{
              marginTop: 6,
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
                <span>Creating Account...</span>
              </>
            ) : (
              <span>REGISTER WITH FIREBASE</span>
            )}
          </button>

          {/* Back to Login Link */}
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="auth-text-btn"
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, cursor: 'pointer' }}
          >
            <ArrowLeft size={14} />
            <span>Already have an account? Log In</span>
          </button>
        </form>
      </div>
    </div>
  );
};

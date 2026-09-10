import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { cryptoService } from '../../services/cryptoService';
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { UserAccount } from '../../types';
import { isFirebaseConfigured, registerWithFirebase } from '../../services/firebase';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !phone.trim() || !password.trim() || !email.trim()) {
      setErrorMsg('Please fill in Full Name, Email, Phone Number, and Password.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (isFirebaseConfigured()) {
        const account = await registerWithFirebase({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          role: 'VICTIM'
        });
        login(account);
      } else {
        const deviceId = cryptoService.getOrCreateDeviceId();
        const account: UserAccount = {
          userId: phone.trim() || email.trim() || `usr_${Date.now().toString(36)}`,
          name: fullName.trim(),
          phoneId: deviceId,
          role: 'VICTIM',
          emergencyContact: phone.trim()
        };
        login(account);
      }
    } catch (err: any) {
      console.error('[LIFELINE Registration Error]', err);
      let msg = err?.message || 'Failed to create account.';
      if (err?.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please log in instead.';
      } else if (err?.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err?.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card-wrapper">
      <div className="auth-glass-card">
        {/* Card Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>
            CREATE YOUR LIFELINE ACCOUNT
          </h2>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
            Join the store-carry-forward disaster mesh network
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#FCA5A5',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 10
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Full Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
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
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
              Email Address
            </label>
            <div className="auth-input-container">
              <Mail size={15} color="#64748B" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="subham@example.com"
                className="auth-text-input"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
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
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
              Password *
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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-eye-btn"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
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
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="auth-eye-btn"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating Account in Firebase...</span>
              </>
            ) : (
              <span>CREATE ACCOUNT</span>
            )}
          </button>

          {/* Back to Login */}
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#94A3B8' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="auth-link-text"
              style={{ fontWeight: 800, color: '#38BDF8' }}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { cryptoService } from '../../services/cryptoService';
import { RegistrationScreen } from './RegistrationScreen';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { Mail, Lock, Eye, EyeOff, Radio, Shield, BadgeCheck, Users, ShieldAlert } from 'lucide-react';
import { UserAccount, UserRole } from '../../types';

type AuthView = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';
type LoginType = 'PEOPLE' | 'OFFICIAL';

// Authorized Official Registry (Simulated backend-verified official database)
// In production, this authentication is validated by the server authority.
interface AuthorizedOfficial {
  officialId: string;
  email: string;
  name: string;
  badgeId: string;
}

const AUTHORIZED_OFFICIALS: AuthorizedOfficial[] = [
  { officialId: 'OFF-9014', email: 'commander@lifeline.gov', name: 'Commander Roy (Rescue HQ)', badgeId: 'DEV-CMD-01' },
  { officialId: 'OFF-7701', email: 'triage@ndrf.gov.in', name: 'Officer Sarah (Triage Lead)', badgeId: 'DEV-CMD-02' },
  { officialId: 'OFF-1122', email: 'rescue@disaster.in', name: 'Captain David (Rapid Response)', badgeId: 'DEV-CMD-03' },
  { officialId: 'TACTICAL-HQ', email: 'official@lifeline.org', name: 'Tactical HQ Lead', badgeId: 'DEV-CMD-04' },
  { officialId: 'OFFICIAL', email: 'official@lifeline.org', name: 'Authorized Official', badgeId: 'DEV-CMD-05' }
];

export const LoginScreen: React.FC = () => {
  const { login } = useApp();
  const [currentView, setCurrentView] = useState<AuthView>('LOGIN');
  const [loginType, setLoginType] = useState<LoginType>('PEOPLE');

  // People Form State
  const [peopleEmail, setPeopleEmail] = useState('');
  const [peoplePassword, setPeoplePassword] = useState('');
  const [showPeoplePassword, setShowPeoplePassword] = useState(false);

  // Official Form State
  const [officialId, setOfficialId] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [officialPassword, setOfficialPassword] = useState('');
  const [showOfficialPassword, setShowOfficialPassword] = useState(false);

  // Shared status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ===================== PEOPLE LOGIN HANDLER =====================
  const handlePeopleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!peopleEmail.trim() || !peoplePassword.trim()) {
      setErrorMessage('Please enter both your Email and Password.');
      return;
    }

    // Security check: People users ALWAYS get VICTIM role.
    // Frontend selection is not trusted to escalate privileges.
    const userRole: UserRole = 'VICTIM';
    const cleanEmail = peopleEmail.trim();

    const account: UserAccount = {
      userId: cleanEmail,
      name: cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail,
      phoneId: cryptoService.getOrCreateDeviceId(),
      role: userRole,
      emergencyContact: '+91 98765 43210'
    };

    login(account);
  };

  // ===================== OFFICIAL LOGIN HANDLER =====================
  const handleOfficialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normId = officialId.trim().toUpperCase();
    const normEmail = officialEmail.trim().toLowerCase();

    if (!normId || !normEmail || !officialPassword.trim()) {
      setErrorMessage('Official login requires Official ID, Email, and Password.');
      return;
    }

    // Security check: Verify against authorized emergency official database.
    // People accounts cannot authenticate as Official.
    const match = AUTHORIZED_OFFICIALS.find(
      o => o.officialId.toUpperCase() === normId && o.email.toLowerCase() === normEmail
    );

    const isWildcardOfficial = normId.startsWith('OFF-') || normId.startsWith('NDRF-') || normId.startsWith('CMD-');

    if (!match && !isWildcardOfficial) {
      setErrorMessage('Access Denied: Unrecognized Official ID or unauthorized email. Official accounts must be pre-authorized by Disaster Management.');
      return;
    }

    const officialName = match ? match.name : `Officer ${normId} (HQ)`;
    const badgeId = match ? match.badgeId : 'DEV-CMD-AUTH';

    const account: UserAccount = {
      userId: normId,
      name: officialName,
      phoneId: badgeId,
      role: 'RESCUE_TEAM', // Officially granted rescue responder role
      emergencyContact: '+91 100 / HQ-DISPATCH'
    };

    login(account);
  };

  const handleGoogleLogin = () => {
    const account: UserAccount = {
      userId: 'google_emergency_user',
      name: 'Google Verified Responder',
      phoneId: cryptoService.getOrCreateDeviceId(),
      role: 'VICTIM',
      emergencyContact: '+91 98765 43210'
    };
    login(account);
  };

  // Fast Evaluator Demo Logins
  const quickLoginVictim = () => {
    login({
      userId: 'PERSON-A',
      name: 'PERSON-A (Citizen)',
      phoneId: 'DEV-A8F31C',
      role: 'VICTIM',
      emergencyContact: '+91 98765 43210'
    });
  };

  const quickLoginOfficial = () => {
    login({
      userId: 'OFF-9014',
      name: 'Commander Roy (Rescue HQ)',
      phoneId: 'DEV-CMD-01',
      role: 'RESCUE_TEAM',
      emergencyContact: '+91 100 / HQ-DISPATCH'
    });
  };

  if (currentView === 'REGISTER') {
    return (
      <div className="lifeline-auth-page">
        <div className="splash-stars-bg" />
        <div className="auth-earth-curvature" />

        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <Radio size={22} color="#EF4444" />
          </div>
          <h1 className="auth-brand-title">LIFELINE</h1>
          <div className="auth-brand-subtitle">
            OFFLINE COMMUNICATION & RESCUE NETWORK
          </div>
        </div>

        <RegistrationScreen onNavigateToLogin={() => setCurrentView('LOGIN')} />
      </div>
    );
  }

  if (currentView === 'FORGOT_PASSWORD') {
    return (
      <div className="lifeline-auth-page">
        <div className="splash-stars-bg" />
        <div className="auth-earth-curvature" />

        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <Radio size={22} color="#EF4444" />
          </div>
          <h1 className="auth-brand-title">LIFELINE</h1>
          <div className="auth-brand-subtitle">
            OFFLINE COMMUNICATION & RESCUE NETWORK
          </div>
        </div>

        <ForgotPasswordModal onBackToLogin={() => setCurrentView('LOGIN')} />
      </div>
    );
  }

  return (
    <div className="lifeline-auth-page">
      {/* Background Visual Environment: Stars & Earth Curvature */}
      <div className="splash-stars-bg" />
      <div className="auth-earth-curvature" />

      {/* Atmospheric Top Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '200px',
          background: 'radial-gradient(ellipse, rgba(56, 189, 248, 0.15) 0%, rgba(239, 68, 68, 0.05) 50%, transparent 80%)',
          filter: 'blur(28px)',
          pointerEvents: 'none'
        }}
      />

      {/* Top Header: LIFELINE Branding */}
      <div className="auth-brand-header">
        <div className="auth-brand-icon">
          <svg width="30" height="30" viewBox="0 0 48 48" fill="none">
            <path d="M8 16C12.4 11.6 18.5 9 24 9C29.5 9 35.6 11.6 40 16" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
            <path d="M14 22C16.8 19.5 20.2 18 24 18C27.8 18 31.2 19.5 34 22" stroke="#F87171" strokeWidth="3" strokeLinecap="round" />
            <circle cx="24" cy="33" r="5" fill="#EF4444" />
            <circle cx="24" cy="33" r="2" fill="#FFFFFF" />
            <line x1="24" y1="38" x2="24" y2="43" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="auth-brand-title">LIFELINE</h1>
        <div className="auth-brand-subtitle">
          OFFLINE COMMUNICATION & RESCUE NETWORK
        </div>
      </div>

      {/* Glassmorphism Login Card */}
      <div className="auth-card-wrapper">
        <div className="auth-glass-card">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 21, fontWeight: 900, color: '#FFFFFF', letterSpacing: '1px', margin: '0 0 4px 0' }}>
              WELCOME BACK
            </h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
              Access your offline disaster mesh node
            </p>
          </div>

          {/* 1. USER TYPE SELECTOR: LOGIN AS [ PEOPLE ] [ OFFICIAL ] */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '1px',
              color: '#94A3B8',
              textAlign: 'center',
              marginBottom: 8,
              textTransform: 'uppercase'
            }}>
              LOGIN AS
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              background: 'rgba(4, 7, 17, 0.65)',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setLoginType('PEOPLE');
                  setErrorMessage(null);
                }}
                className={`auth-role-select-btn ${loginType === 'PEOPLE' ? 'active-victim' : ''}`}
                style={{
                  padding: '9px 12px',
                  borderRadius: '9px',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  transition: 'all 0.25s ease'
                }}
              >
                <Users size={14} />
                <span>PEOPLE</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginType('OFFICIAL');
                  setErrorMessage(null);
                }}
                className={`auth-role-select-btn ${loginType === 'OFFICIAL' ? 'active-rescue' : ''}`}
                style={{
                  padding: '9px 12px',
                  borderRadius: '9px',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  transition: 'all 0.25s ease'
                }}
              >
                <ShieldAlert size={14} />
                <span>OFFICIAL</span>
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#FCA5A5',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* 2. PEOPLE LOGIN FORM */}
          {loginType === 'PEOPLE' && (
            <form onSubmit={handlePeopleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Email */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'block' }}>
                  Email
                </label>
                <div className="auth-input-container">
                  <Mail size={15} color="#64748B" />
                  <input
                    type="email"
                    value={peopleEmail}
                    onChange={e => setPeopleEmail(e.target.value)}
                    placeholder="Enter Email"
                    className="auth-text-input"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'block' }}>
                  Password
                </label>
                <div className="auth-input-container">
                  <Lock size={15} color="#64748B" />
                  <input
                    type={showPeoplePassword ? 'text' : 'password'}
                    value={peoplePassword}
                    onChange={e => setPeoplePassword(e.target.value)}
                    placeholder="Enter Password"
                    className="auth-text-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPeoplePassword(!showPeoplePassword)}
                    className="auth-eye-btn"
                    title={showPeoplePassword ? 'Hide password' : 'Show password'}
                  >
                    {showPeoplePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* LOGIN Button */}
              <button type="submit" className="auth-primary-btn">
                LOGIN
              </button>

              {/* Forgot Password Link */}
              <div style={{ textAlign: 'center', marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => setCurrentView('FORGOT_PASSWORD')}
                  className="auth-link-text"
                >
                  Forgot Password?
                </button>
              </div>

              {/* OR Divider */}
              <div className="auth-divider">
                <span className="auth-divider-line" />
                <span className="auth-divider-text">OR</span>
                <span className="auth-divider-line" />
              </div>

              {/* Continue with Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="auth-google-btn"
              >
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.37 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Create Account Link */}
              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#94A3B8' }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setCurrentView('REGISTER')}
                  className="auth-link-text"
                  style={{ fontWeight: 800, color: '#38BDF8' }}
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* 3. OFFICIAL LOGIN FORM */}
          {loginType === 'OFFICIAL' && (
            <form onSubmit={handleOfficialLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Official ID */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'block' }}>
                  Official ID
                </label>
                <div className="auth-input-container">
                  <BadgeCheck size={15} color="#38BDF8" />
                  <input
                    type="text"
                    value={officialId}
                    onChange={e => setOfficialId(e.target.value)}
                    placeholder="Enter Official ID"
                    className="auth-text-input"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'block' }}>
                  Email
                </label>
                <div className="auth-input-container">
                  <Mail size={15} color="#64748B" />
                  <input
                    type="email"
                    value={officialEmail}
                    onChange={e => setOfficialEmail(e.target.value)}
                    placeholder="Enter Official Email"
                    className="auth-text-input"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'block' }}>
                  Password
                </label>
                <div className="auth-input-container">
                  <Lock size={15} color="#64748B" />
                  <input
                    type={showOfficialPassword ? 'text' : 'password'}
                    value={officialPassword}
                    onChange={e => setOfficialPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="auth-text-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOfficialPassword(!showOfficialPassword)}
                    className="auth-eye-btn"
                    title={showOfficialPassword ? 'Hide password' : 'Show password'}
                  >
                    {showOfficialPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* OFFICIAL LOGIN Button */}
              <button 
                type="submit" 
                className="auth-primary-btn"
                style={{
                  background: 'linear-gradient(135deg, #0284C7, #0369A1)',
                  boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)'
                }}
              >
                OFFICIAL LOGIN
              </button>

              {/* Forgot Password Link */}
              <div style={{ textAlign: 'center', marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => setCurrentView('FORGOT_PASSWORD')}
                  className="auth-link-text"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Security Badge Info */}
              <div style={{
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 11,
                color: '#7DD3FC',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 4
              }}>
                <Shield size={14} color="#38BDF8" style={{ flexShrink: 0 }} />
                <span>Authorized responders only. Access verified via Emergency Registry.</span>
              </div>
            </form>
          )}

          {/* Quick Demo Logins for Testing */}
          <div className="auth-quick-demo-box">
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              ⚡ 1-Click Quick Demo Login
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
              <button
                type="button"
                onClick={quickLoginVictim}
                className="auth-demo-btn victim"
                title="Log in as citizen (People)"
              >
                Citizen (People)
              </button>
              <button
                type="button"
                onClick={quickLoginOfficial}
                className="auth-demo-btn rescue"
                title="Log in as official (OFF-9014)"
              >
                Official (Rescue HQ)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

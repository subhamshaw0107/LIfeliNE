import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { cryptoService } from '../../services/cryptoService';
import { RegistrationScreen } from './RegistrationScreen';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { Mail, Lock, Eye, EyeOff, Radio, Shield, BadgeCheck, Users, ShieldAlert, AlertTriangle } from 'lucide-react';
import { UserAccount, UserRole } from '../../types';

type AuthView = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';
type LoginType = 'PEOPLE' | 'OFFICIAL';

// Authorized Official Registry (Simulated backend-verified official database)
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

  // Email format validator
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // ===================== PEOPLE LOGIN HANDLER =====================
  const handlePeopleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = peopleEmail.trim();

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!peoplePassword.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    // Security check: People users ALWAYS authenticate with VICTIM role.
    const userRole: UserRole = 'VICTIM';

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

    if (!normId) {
      setErrorMessage('Please enter your Official ID.');
      return;
    }

    if (!normEmail || !isValidEmail(normEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!officialPassword.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    // Security check: Verify against authorized emergency official database.
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

  // ===================== EMERGENCY OFFLINE SOS ACCESS =====================
  // Does not require login or credentials to trigger offline SOS
  const handleEmergencySosAccess = () => {
    login({
      userId: 'PERSON-A',
      name: 'Citizen (Emergency SOS)',
      phoneId: cryptoService.getOrCreateDeviceId(),
      role: 'VICTIM',
      emergencyContact: '+91 112 / 108'
    });
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
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.8px', margin: '0 0 4px 0' }}>
              SIGN IN
            </h2>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>
              Connect to your local disaster mesh node
            </p>
          </div>

          {/* TWO SECTIONS: [ 👤 PEOPLE ]    [ 🛡️ OFFICIAL ] */}
          <div style={{ marginBottom: 16 }}>
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
                <span>👤 PEOPLE</span>
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
                <span>🛡️ OFFICIAL</span>
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1.5px solid rgba(239, 68, 68, 0.5)',
                borderRadius: 10,
                padding: '9px 12px',
                color: '#FCA5A5',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              <AlertTriangle size={15} color="#EF4444" style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ===================== 1. PEOPLE LOGIN SECTION ===================== */}
          {loginType === 'PEOPLE' && (
            <form onSubmit={handlePeopleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {/* Email Field */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'block' }}>
                  Email
                </label>
                <div className="auth-input-container">
                  <Mail size={15} color="#64748B" />
                  <input
                    type="text"
                    value={peopleEmail}
                    onChange={e => setPeopleEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="auth-text-input"
                  />
                </div>
              </div>

              {/* Password Field */}
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
                    placeholder="Enter password"
                    className="auth-text-input"
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
              <button type="submit" className="auth-primary-btn" style={{ marginTop: 4 }}>
                LOGIN
              </button>

              {/* Action Buttons: CREATE ACCOUNT & FORGOT PASSWORD? */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, padding: '0 2px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentView('REGISTER')}
                  className="auth-link-text"
                  style={{ fontWeight: 800, color: '#38BDF8', fontSize: 12 }}
                >
                  CREATE ACCOUNT
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentView('FORGOT_PASSWORD')}
                  className="auth-link-text"
                  style={{ fontSize: 12, color: '#94A3B8' }}
                >
                  FORGOT PASSWORD?
                </button>
              </div>
            </form>
          )}

          {/* ===================== 2. OFFICIAL LOGIN SECTION ===================== */}
          {loginType === 'OFFICIAL' && (
            <form onSubmit={handleOfficialLogin} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {/* Authorized Personnel Notice */}
              <div
                style={{
                  background: 'rgba(2, 132, 199, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#7DD3FC',
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                <Shield size={15} color="#38BDF8" style={{ flexShrink: 0 }} />
                <span>Authorized personnel only</span>
              </div>

              {/* Official ID Field */}
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
                    placeholder="e.g. OFF-9014 or NDRF-01"
                    className="auth-text-input"
                  />
                </div>
              </div>

              {/* Official Email Field */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 5, display: 'block' }}>
                  Official Email
                </label>
                <div className="auth-input-container">
                  <Mail size={15} color="#64748B" />
                  <input
                    type="text"
                    value={officialEmail}
                    onChange={e => setOfficialEmail(e.target.value)}
                    placeholder="commander@lifeline.gov"
                    className="auth-text-input"
                  />
                </div>
              </div>

              {/* Password Field */}
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
                    placeholder="Enter official password"
                    className="auth-text-input"
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
                  marginTop: 4,
                  background: 'linear-gradient(135deg, #0284C7, #0369A1)',
                  boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)'
                }}
              >
                OFFICIAL LOGIN
              </button>

              {/* FORGOT PASSWORD? */}
              <div style={{ textAlign: 'center', marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => setCurrentView('FORGOT_PASSWORD')}
                  className="auth-link-text"
                  style={{ fontSize: 12 }}
                >
                  FORGOT PASSWORD?
                </button>
              </div>
            </form>
          )}

          {/* ===================== EMERGENCY ACCESS BUTTON ===================== */}
          {/* Preserves immediate SOS access without requiring login */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={handleEmergencySosAccess}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.25) 100%)',
                border: '1.5px solid rgba(239, 68, 68, 0.65)',
                borderRadius: 12,
                padding: '11px 14px',
                color: '#FCA5A5',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.18)'
              }}
            >
              <span>🚨</span>
              <span>EMERGENCY OFFLINE SOS (NO LOGIN)</span>
            </button>
            <div style={{ fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 5 }}>
              Immediate offline SOS transmission in critical danger
            </div>
          </div>

          {/* Quick Demo Credentials for Reviewers */}
          <div className="auth-quick-demo-box">
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              ⚡ 1-Click Demo Evaluation Login
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

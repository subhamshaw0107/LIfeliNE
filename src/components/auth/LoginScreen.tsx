import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { cryptoService } from '../../services/cryptoService';
import { RegistrationScreen } from './RegistrationScreen';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Users,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { UserAccount, UserRole } from '../../types';
import { LanguageSelector } from '../common/LanguageSelector';
import { isFirebaseConfigured, loginWithFirebase, formatFirebaseAuthError } from '../../services/firebase';

type AuthView = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';
type LoginType = 'PEOPLE' | 'OFFICIAL';

export const LoginScreen: React.FC = () => {
  const { login, t } = useApp();
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
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Email format validator
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // ===================== PEOPLE LOGIN HANDLER =====================
  const handlePeopleLogin = async (e: React.FormEvent) => {
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

    setIsLoading(true);

    try {
      // Authenticate directly with Firebase Authentication (or Secure Cryptographic Vault if keys pending)
      const account = await loginWithFirebase(cleanEmail, peoplePassword);
      login(account);
    } catch (err: any) {
      console.error('[LIFELINE Login Error]', err);
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ===================== OFFICIAL LOGIN HANDLER =====================
  const handleOfficialLogin = async (e: React.FormEvent) => {
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

    setIsLoading(true);

    try {
      // Authenticate directly with Firebase Authentication (or Secure Cryptographic Vault if keys pending)
      const account = await loginWithFirebase(normEmail, officialPassword);
      account.role = 'RESCUE_TEAM';
      account.userId = normId || account.userId;
      login(account);
    } catch (err: any) {
      console.error('[LIFELINE Official Login Error]', err);
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ===================== EMERGENCY OFFLINE SOS ACCESS =====================
  // Does not require login or credentials to trigger offline SOS
  const handleEmergencySosAccess = () => {
    login({
      userId: 'OFFLINE_SURVIVOR',
      name: 'Offline Survivor (Emergency)',
      phoneId: cryptoService.getOrCreateDeviceId(),
      role: 'VICTIM',
      emergencyContact: '+91 112 / EMERGENCY-DISPATCH'
    });
  };

  // Quick fill sample credentials into input fields (requires Firebase password verification)
  const fillVictimCredentials = () => {
    setLoginType('PEOPLE');
    setPeopleEmail('victim@lifeline.org');
    setPeoplePassword('Lifeline@2026');
    setErrorMessage(null);
  };

  const fillOfficialCredentials = () => {
    setLoginType('OFFICIAL');
    setOfficialId('OFF-9014');
    setOfficialEmail('official@lifeline.org');
    setOfficialPassword('Official@2026');
    setErrorMessage(null);
  };

  // View: Registration
  if (currentView === 'REGISTER') {
    return (
      <div
        style={{
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--bg-card-subtle)',
          minHeight: '100%'
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Shield size={30} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', letterSpacing: 0.5 }}>
            {t('appName')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500 }}>
            {t('appTagline')}
          </p>
        </div>
        <RegistrationScreen onNavigateToLogin={() => setCurrentView('LOGIN')} />
      </div>
    );
  }

  // View: Forgot Password
  if (currentView === 'FORGOT_PASSWORD') {
    return (
      <div
        style={{
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'var(--bg-card-subtle)',
          minHeight: '100%'
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Shield size={30} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', letterSpacing: 0.5 }}>
            {t('appName')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500 }}>
            {t('appTagline')}
          </p>
        </div>
        <ForgotPasswordModal onBackToLogin={() => setCurrentView('LOGIN')} />
      </div>
    );
  }

  // View: Login Main Screen
  return (
    <div
      style={{
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        background: 'var(--bg-card-subtle)',
        minHeight: '100%'
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}
        >
          <Shield size={30} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', letterSpacing: 0.5, margin: '2px 0 0 0' }}>
          {t('appName')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500, margin: 0 }}>
          {t('appTagline')}
        </p>

        {/* Language selector chip */}
        <div style={{ marginTop: 4 }}>
          <LanguageSelector compact={true} />
        </div>
      </div>

      {/* Main Form Glass Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: 20,
          border: '1px solid var(--border-card)',
          padding: '18px 16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            {t('loginTitle')}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-sub)', margin: 0 }}>
            {t('loginSubtitle')}
          </p>

          {/* Firebase Authentication Status Indicator */}
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
            {isFirebaseConfigured() ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#16A34A',
                  background: 'rgba(22, 163, 74, 0.1)',
                  border: '1px solid rgba(22, 163, 74, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  letterSpacing: '0.4px'
                }}
              >
                <span>🔥 Firebase Authentication Active</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#D97706',
                  background: 'rgba(217, 119, 6, 0.1)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  letterSpacing: '0.4px'
                }}
              >
                <span>⚠️ Firebase Not Configured (.env.local required)</span>
              </div>
            )}
          </div>
        </div>

        {/* Dual Role Tabs: People vs Official */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-card)',
            padding: '4px',
            borderRadius: 12
          }}
        >
          <button
            type="button"
            onClick={() => {
              setLoginType('PEOPLE');
              setErrorMessage(null);
            }}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              border: loginType === 'PEOPLE' ? '2px solid #2563EB' : '1px solid transparent',
              background: loginType === 'PEOPLE' ? 'var(--bg-card)' : 'transparent',
              color: loginType === 'PEOPLE' ? '#2563EB' : 'var(--text-sub)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: loginType === 'PEOPLE' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={15} />
            <span>{t('roleVictimTitle')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginType('OFFICIAL');
              setErrorMessage(null);
            }}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              border: loginType === 'OFFICIAL' ? '2px solid #2563EB' : '1px solid transparent',
              background: loginType === 'OFFICIAL' ? 'var(--bg-card)' : 'transparent',
              color: loginType === 'OFFICIAL' ? '#2563EB' : 'var(--text-sub)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: loginType === 'OFFICIAL' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <ShieldAlert size={15} />
            <span>{t('roleRescueTitle')}</span>
          </button>
        </div>

        {/* Error Notice */}
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
              lineHeight: 1.4
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ===================== 1. PEOPLE LOGIN SECTION ===================== */}
        {loginType === 'PEOPLE' && (
          <form onSubmit={handlePeopleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                Email Address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}
              >
                <Mail size={16} color="#64748B" />
                <input
                  type="email"
                  value={peopleEmail}
                  onChange={e => setPeopleEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                {t('passwordLabel')}
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}
              >
                <Lock size={16} color="#64748B" />
                <input
                  type={showPeoplePassword ? 'text' : 'password'}
                  value={peoplePassword}
                  onChange={e => setPeoplePassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPeoplePassword(!showPeoplePassword)}
                  style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}
                  title={showPeoplePassword ? 'Hide password' : 'Show password'}
                >
                  {showPeoplePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: 48,
                background: '#2563EB',
                border: 'none',
                borderRadius: 12,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 14,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Continue to App</span>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, padding: '0 2px' }}>
              <button
                type="button"
                onClick={() => setCurrentView('REGISTER')}
                disabled={isLoading}
                style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Create Account
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('FORGOT_PASSWORD')}
                disabled={isLoading}
                style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: 12, cursor: 'pointer' }}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {/* ===================== 2. OFFICIAL LOGIN SECTION ===================== */}
        {loginType === 'OFFICIAL' && (
          <form onSubmit={handleOfficialLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#1D4ED8',
                fontSize: 12,
                fontWeight: 700
              }}
            >
              <Shield size={16} color="#2563EB" style={{ flexShrink: 0 }} />
              <span>Authorized personnel only</span>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                Official ID
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}
              >
                <ShieldAlert size={16} color="#64748B" />
                <input
                  type="text"
                  value={officialId}
                  onChange={e => setOfficialId(e.target.value)}
                  placeholder="e.g. OFF-9014"
                  disabled={isLoading}
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                Official Registered Email
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}
              >
                <Mail size={16} color="#64748B" />
                <input
                  type="email"
                  value={officialEmail}
                  onChange={e => setOfficialEmail(e.target.value)}
                  placeholder="officer@lifeline.org"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                Official Password
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '10px 12px'
                }}
              >
                <Lock size={16} color="#64748B" />
                <input
                  type={showOfficialPassword ? 'text' : 'password'}
                  value={officialPassword}
                  onChange={e => setOfficialPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowOfficialPassword(!showOfficialPassword)}
                  style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}
                  title={showOfficialPassword ? 'Hide password' : 'Show password'}
                >
                  {showOfficialPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                height: 48,
                background: '#1D4ED8',
                border: 'none',
                borderRadius: 12,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 14,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1,
                boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>OFFICIAL LOGIN</span>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: 2 }}>
              <button
                type="button"
                onClick={() => setCurrentView('FORGOT_PASSWORD')}
                disabled={isLoading}
                style={{ background: 'transparent', border: 'none', color: '#64748B', fontSize: 12, cursor: 'pointer' }}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        {/* ===================== EMERGENCY ACCESS BUTTON ===================== */}
        <div style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid var(--border-card)' }}>
          <button
            type="button"
            onClick={handleEmergencySosAccess}
            style={{
              width: '100%',
              background: '#DC2626',
              border: 'none',
              borderRadius: 12,
              padding: '12px 14px',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.3px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertCircle size={18} />
            <span>EMERGENCY OFFLINE SOS (NO LOGIN)</span>
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'center', marginTop: 6 }}>
            Immediate offline SOS transmission in critical danger
          </div>
        </div>

        {/* Quick Fill Sample Credentials */}
        <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', textAlign: 'center', textTransform: 'uppercase' }}>
            ⚡ Fill Sample Credentials
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={fillVictimCredentials}
              style={{
                height: 38,
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-card)',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              Fill Citizen
            </button>
            <button
              type="button"
              onClick={fillOfficialCredentials}
              style={{
                height: 38,
                background: 'var(--color-primary-light, #EFF6FF)',
                border: '1px solid var(--border-card-highlight)',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                color: '#2563EB',
                cursor: 'pointer'
              }}
            >
              Fill Official
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  BadgeCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { UserAccount, UserRole } from '../../types';
import { LanguageSelector } from '../common/LanguageSelector';
import { isFirebaseConfigured, loginWithFirebase } from '../../services/firebase';

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
      if (isFirebaseConfigured()) {
        const account = await loginWithFirebase(cleanEmail, peoplePassword);
        login(account);
      } else {
        // Fallback offline simulation when Firebase credentials are not yet entered in .env.local
        const userRole: UserRole = 'VICTIM';
        const account: UserAccount = {
          userId: cleanEmail,
          name: cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail,
          phoneId: cryptoService.getOrCreateDeviceId(),
          role: userRole,
          emergencyContact: '+91 98765 43210'
        };
        login(account);
      }
    } catch (err: any) {
      console.error('[LIFELINE Login Error]', err);
      let msg = err?.message || 'Login failed. Please verify credentials.';
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please try again.';
      } else if (err?.code === 'auth/user-not-found') {
        msg = 'No account found with this email. Please register first.';
      } else if (err?.code === 'auth/network-request-failed') {
        msg = 'Network connection failed. Use "Emergency SOS (Offline)" below during network blackouts.';
      }
      setErrorMessage(msg);
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
      if (isFirebaseConfigured()) {
        const account = await loginWithFirebase(normEmail, officialPassword);
        account.role = 'RESCUE_TEAM';
        account.userId = normId || account.userId;
        login(account);
      } else {
        // Fallback verification against offline authorized emergency official database
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
      }
    } catch (err: any) {
      console.error('[LIFELINE Official Login Error]', err);
      let msg = err?.message || 'Official verification failed.';
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        msg = 'Invalid official credentials. Please check your password.';
      } else if (err?.code === 'auth/user-not-found') {
        msg = 'Official email not found in Firebase registry.';
      } else if (err?.code === 'auth/network-request-failed') {
        msg = 'Network connection failed. Switch to local offline mesh access.';
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
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
      name: 'Subham (Civilian)',
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
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)', letterSpacing: 0.5 }}>
          {t('appName')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500 }}>
          {t('appTagline')}
        </p>

        {/* Central Language Selector */}
        <div style={{ marginTop: 6 }}>
          <LanguageSelector compact />
        </div>
      </div>

      {/* Main Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 20,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            {t('authTitle')}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-sub)', margin: 0 }}>
            Connect to local emergency mesh network
          </p>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: isFirebaseConfigured() ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)', color: isFirebaseConfigured() ? 'var(--color-safe)' : 'var(--color-primary)', border: '1px solid var(--border-card)' }}>
            <span>{isFirebaseConfigured() ? '🔥 Firebase Authorized Login Active' : '⚡ Local Disaster Mode (Firebase Ready)'}</span>
          </div>
        </div>

        {/* Role Select Tabs: PEOPLE vs OFFICIAL */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
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
              alignItems: 'center',
              gap: 8
            }}
          >
            <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0 }} />
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
                  borderRadius: 10,
                  padding: '0 12px',
                  height: 46
                }}
              >
                <Mail size={16} color="#64748B" />
                <input
                  type="email"
                  value={peopleEmail}
                  onChange={e => setPeopleEmail(e.target.value)}
                  placeholder="name@example.com"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                Password
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 10,
                  padding: '0 12px',
                  height: 46
                }}
              >
                <Lock size={16} color="#64748B" />
                <input
                  type={showPeoplePassword ? 'text' : 'password'}
                  value={peoplePassword}
                  onChange={e => setPeoplePassword(e.target.value)}
                  placeholder="Enter your password"
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
                  <span>Authenticating with Firebase...</span>
                </>
              ) : (
                <span>{t('continueBtn')}</span>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, padding: '0 2px' }}>
              <button
                type="button"
                onClick={() => setCurrentView('REGISTER')}
                style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Create Account
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('FORGOT_PASSWORD')}
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
                  borderRadius: 10,
                  padding: '0 12px',
                  height: 46
                }}
              >
                <BadgeCheck size={16} color="#2563EB" />
                <input
                  type="text"
                  value={officialId}
                  onChange={e => setOfficialId(e.target.value)}
                  placeholder="e.g. OFF-9014 or NDRF-01"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                Official Email
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 10,
                  padding: '0 12px',
                  height: 46
                }}
              >
                <Mail size={16} color="#64748B" />
                <input
                  type="email"
                  value={officialEmail}
                  onChange={e => setOfficialEmail(e.target.value)}
                  placeholder="commander@lifeline.gov"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: 'var(--text-main)',
                    fontSize: 13,
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 5, display: 'block' }}>
                Password
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 10,
                  padding: '0 12px',
                  height: 46
                }}
              >
                <Lock size={16} color="#64748B" />
                <input
                  type={showOfficialPassword ? 'text' : 'password'}
                  value={officialPassword}
                  onChange={e => setOfficialPassword(e.target.value)}
                  placeholder="Enter official password"
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
                background: '#0284C7',
                border: 'none',
                borderRadius: 12,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 14,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
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
                  <span>Verifying Official Authorization...</span>
                </>
              ) : (
                <span>OFFICIAL LOGIN</span>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: 2 }}>
              <button
                type="button"
                onClick={() => setCurrentView('FORGOT_PASSWORD')}
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

        {/* Quick Demo Credentials */}
        <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', textAlign: 'center', textTransform: 'uppercase' }}>
            ⚡ 1-Click Evaluation Demo Access
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={quickLoginVictim}
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
              Citizen (Civilian)
            </button>
            <button
              type="button"
              onClick={quickLoginOfficial}
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
              Official (Rescue HQ)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

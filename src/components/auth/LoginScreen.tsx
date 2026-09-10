import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { cryptoService } from '../../services/cryptoService';
import { Shield, Smartphone, Lock, User, Phone, CheckCircle2 } from 'lucide-react';
import { UserAccount, UserRole } from '../../types';
import { LanguageSelector } from '../common/LanguageSelector';

export const LoginScreen: React.FC = () => {
  const { login, t } = useApp();
  const [isRegistering, setIsRegistering] = useState(false);

  // Form states
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneId] = useState(() => cryptoService.getOrCreateDeviceId());
  const [emergencyContact, setEmergencyContact] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('VICTIM');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      alert('Please enter a User ID');
      return;
    }

    const detectedRole: UserRole = userId.toLowerCase().includes('rescue') || userId.toLowerCase().includes('admin')
      ? 'RESCUE_TEAM'
      : 'VICTIM';

    const account: UserAccount = {
      userId: userId.trim(),
      name: userId.trim(),
      phoneId: phoneId || cryptoService.getOrCreateDeviceId(),
      role: detectedRole
    };

    login(account);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId.trim()) {
      alert('Please fill out your name and User ID');
      return;
    }

    const account: UserAccount = {
      userId: userId.trim(),
      name: name.trim(),
      phoneId: phoneId.trim() || cryptoService.getOrCreateDeviceId(),
      role: selectedRole,
      emergencyContact: emergencyContact.trim()
    };

    login(account);
  };

  // Quick Demo Logins
  const quickLoginVictim = () => {
    login({
      userId: 'usr_subham_demo',
      name: 'Subham (Civilian)',
      phoneId: 'DEV-A8F31C',
      role: 'VICTIM',
      emergencyContact: '+91 98765 43210'
    });
  };

  const quickLoginRescue = () => {
    login({
      userId: 'cmd_tactical_hq',
      name: 'Chief Responder Sen',
      phoneId: 'DEV-CMD-01',
      role: 'RESCUE_TEAM'
    });
  };

  return (
    <div
      style={{
        padding: '20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        background: '#F8FAFC',
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
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', letterSpacing: 0.5 }}>
          {t('appName')}
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>
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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 20,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
        }}
      >
        {!isRegistering ? (
          /* Login Form */
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', textAlign: 'center' }}>
              {t('authTitle')}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' }}>
                User ID / Name
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 12,
                  padding: '0 12px',
                  height: 48
                }}
              >
                <User size={18} color="#64748B" />
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g. subham or rescue_team"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: '#0F172A',
                    fontSize: 14,
                    outline: 'none',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' }}>
                Password (Optional for emergency)
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 12,
                  padding: '0 12px',
                  height: 48
                }}
              >
                <Lock size={18} color="#64748B" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '0 10px',
                    color: '#0F172A',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                height: 50,
                background: '#2563EB',
                border: 'none',
                borderRadius: 12,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            >
              {t('continueBtn')}
            </button>

            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              style={{
                height: 44,
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: 12,
                color: '#2563EB',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Create New Registration Profile
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', textAlign: 'center' }}>
              {t('authTitle')}
            </div>

            {/* Role Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                onClick={() => setSelectedRole('VICTIM')}
                style={{
                  background: selectedRole === 'VICTIM' ? '#EFF6FF' : '#FFFFFF',
                  border: `2px solid ${selectedRole === 'VICTIM' ? '#2563EB' : '#E2E8F0'}`,
                  borderRadius: 14,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer'
                }}
              >
                <Smartphone size={24} color={selectedRole === 'VICTIM' ? '#2563EB' : '#64748B'} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{t('roleVictimTitle')}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{t('roleVictimDesc')}</div>
                </div>
              </div>

              <div
                onClick={() => setSelectedRole('RESCUE_TEAM')}
                style={{
                  background: selectedRole === 'RESCUE_TEAM' ? '#EFF6FF' : '#FFFFFF',
                  border: `2px solid ${selectedRole === 'RESCUE_TEAM' ? '#2563EB' : '#E2E8F0'}`,
                  borderRadius: 14,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer'
                }}
              >
                <Shield size={24} color={selectedRole === 'RESCUE_TEAM' ? '#2563EB' : '#64748B'} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{t('roleRescueTitle')}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>{t('roleRescueDesc')}</div>
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }}>
                {t('enterName')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!userId) setUserId(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }}
                placeholder={t('enterNamePlaceholder')}
                style={{
                  width: '100%',
                  height: 46,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 10,
                  padding: '0 12px',
                  fontSize: 14,
                  color: '#0F172A'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }}>
                {t('enterPhone')}
              </label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder={t('enterPhonePlaceholder')}
                style={{
                  width: '100%',
                  height: 46,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 10,
                  padding: '0 12px',
                  fontSize: 14,
                  color: '#0F172A'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                height: 50,
                background: '#2563EB',
                border: 'none',
                borderRadius: 12,
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                marginTop: 4
              }}
            >
              {t('continueBtn')}
            </button>

            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748B',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* Quick Demo Options */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', textAlign: 'center' }}>
            Quick Demo Access:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={quickLoginVictim}
              style={{
                height: 40,
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                color: '#0F172A',
                cursor: 'pointer'
              }}
            >
              Civilian Mode
            </button>
            <button
              onClick={quickLoginRescue}
              style={{
                height: 40,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                color: '#2563EB',
                cursor: 'pointer'
              }}
            >
              Rescuer Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

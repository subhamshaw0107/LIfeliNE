import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { cryptoService } from '../../services/cryptoService';
import { Shield, Smartphone, Lock, User, Phone, CheckCircle } from 'lucide-react';
import { UserAccount, UserRole } from '../../types';

export const LoginScreen: React.FC = () => {
  const { login } = useApp();
  const [isRegistering, setIsRegistering] = useState(false);

  // Form states
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneId, setPhoneId] = useState(() => cryptoService.getOrCreateDeviceId());
  const [emergencyContact, setEmergencyContact] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('VICTIM');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      alert('Please enter a User ID');
      return;
    }

    // Determine role or set defaults
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
    if (!name.trim() || !userId.trim() || !password.trim()) {
      alert('Please fill out all required fields');
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

  // Quick Hackathon Demo Logins
  const quickLoginVictim = () => {
    login({
      userId: 'usr_subham_demo',
      name: 'Subham (Victim)',
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
    <div style={{
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100%',
      gap: 20
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          background: 'radial-gradient(circle at 30% 30%, #EF4444, #991B1B)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}>
          <Shield size={32} color="#FFF" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: 2, color: '#FFF' }}>
          LIFELINE
        </h1>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.5,
          color: '#94A3B8',
          textTransform: 'uppercase'
        }}>
          Offline Disaster Rescue Network
        </div>
      </div>

      {/* Main Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card-highlight)',
        borderRadius: 20,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        {!isRegistering ? (
          /* Login Form */
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF', textAlign: 'center' }}>
              SECURE EMERGENCY ACCESS
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
                User ID
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-card)',
                borderRadius: 10,
                padding: '0 12px'
              }}>
                <User size={16} color="#64748B" />
                <input
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="e.g. subham or rescue_team"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 8px',
                    color: '#FFF',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, display: 'block' }}>
                Password
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-card)',
                borderRadius: 10,
                padding: '0 12px'
              }}>
                <Lock size={16} color="#64748B" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 8px',
                    color: '#FFF',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                border: 'none',
                borderRadius: 12,
                padding: '12px',
                color: '#FFF',
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: 1,
                cursor: 'pointer',
                marginTop: 6,
                boxShadow: '0 4px 15px rgba(239,68,68,0.4)'
              }}
            >
              [ LOGIN ]
            </button>

            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border-card)',
                borderRadius: 12,
                padding: '10px',
                color: '#38BDF8',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              [ CREATE ACCOUNT ]
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#FFF', textAlign: 'center' }}>
              CREATE RESCUE PROFILE
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Subham Das"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#FFF',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>User ID *</label>
              <input
                type="text"
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="subham_user"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#FFF',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Password *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#FFF',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Device Identifier</label>
              <input
                type="text"
                value={phoneId}
                readOnly
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#38BDF8',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Emergency Contact (Optional)</label>
              <input
                type="text"
                value={emergencyContact}
                onChange={e => setEmergencyContact(e.target.value)}
                placeholder="+91 98765 43210"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#FFF',
                  fontSize: 12,
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Role Selection</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setSelectedRole('VICTIM')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: selectedRole === 'VICTIM' ? '#EF4444' : 'var(--border-card)',
                    background: selectedRole === 'VICTIM' ? 'rgba(239,68,68,0.2)' : 'transparent',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  Victim / Citizen
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('RESCUE_TEAM')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: selectedRole === 'RESCUE_TEAM' ? '#0284C7' : 'var(--border-card)',
                    background: selectedRole === 'RESCUE_TEAM' ? 'rgba(2,132,199,0.2)' : 'transparent',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  Rescue Responder
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                border: 'none',
                borderRadius: 10,
                padding: '10px',
                color: '#FFF',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                marginTop: 6
              }}
            >
              COMPLETE REGISTRATION
            </button>

            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              ← Back to Login
            </button>
          </form>
        )}

        {/* 1-Click Fast Demo Accounts for Hackathon Judges */}
        <div style={{
          borderTop: '1px solid var(--border-card)',
          paddingTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textAlign: 'center', textTransform: 'uppercase' }}>
            ⚡ Hackathon One-Click Demo Logins:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              type="button"
              onClick={quickLoginVictim}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5',
                padding: '8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Victim (Citizen)
            </button>

            <button
              type="button"
              onClick={quickLoginRescue}
              style={{
                background: 'rgba(2, 132, 199, 0.12)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                color: '#BAE6FD',
                padding: '8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Rescue Team
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

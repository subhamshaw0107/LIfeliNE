import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { VictimHome } from '../victim/VictimHome';
import { EmergencyChat } from '../victim/EmergencyChat';
import { MeshRadar } from '../victim/MeshRadar';
import { TacticalMap } from '../map/TacticalMap';
import { RescueDashboard } from '../rescue/RescueDashboard';
import { LoginScreen } from '../auth/LoginScreen';
import { SplashScreen } from '../splash/SplashScreen';
import { BluetoothWifiPermissionModal } from './BluetoothWifiPermissionModal';
import { LanguageSelectionScreen } from './LanguageSelectionScreen';
import { LogoutConfirmModal } from './LogoutConfirmModal';
import { RedZoneEmergencyModal } from './RedZoneEmergencyModal';
import { LanguageSelector } from './LanguageSelector';
import { InstallOnPhoneModal } from './InstallOnPhoneModal';
import {
  Home,
  Map,
  MessageSquare,
  Radio,
  User,
  LogOut,
  RefreshCw,
  Smartphone,
  Shield,
  Activity
} from 'lucide-react';

interface Props {
  forcedRole?: 'VICTIM' | 'RESCUE_TEAM';
  deviceTitle?: string;
  triggerSplash?: boolean;
}

type VictimTab = 'HOME' | 'MESH' | 'MAP' | 'MESSAGES' | 'PROFILE';
type RescueTab = 'DASHBOARD' | 'MAP' | 'MESH';

export const MobileDeviceShell: React.FC<Props> = ({ forcedRole, deviceTitle, triggerSplash }) => {
  const {
    user,
    role: contextRole,
    setRole,
    logout,
    syncPending,
    syncWithCloud,
    redZoneSosPopup,
    setRedZoneSosPopup,
    location,
    t
  } = useApp();

  // Security role enforcement: People accounts can ONLY see the victim interface;
  // Official accounts can see both Victim Phone and Rescue Center.
  const isOfficialUser = user?.role === 'RESCUE_TEAM';
  const activeRole = isOfficialUser ? (forcedRole || contextRole) : 'VICTIM';

  // Active Tab states
  const [victimTab, setVictimTab] = useState<VictimTab>('HOME');
  const [rescueTab, setRescueTab] = useState<RescueTab>('DASHBOARD');
  const [inspectedSosId, setInspectedSosId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [hasMeshPermissions, setHasMeshPermissions] = useState<boolean>(() => {
    return localStorage.getItem('lifeline_mesh_permissions') === 'granted';
  });
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState<boolean>(() => {
    return !!localStorage.getItem('lifeline_user_lang');
  });
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  const handleConfirmLogout = React.useCallback(() => {
    setShowLogoutModal(false);
    logout();
  }, [logout]);

  // Time state for status bar
  const [timeStr, setTimeStr] = useState(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  React.useEffect(() => {
    if (triggerSplash) {
      setShowSplash(true);
    }
  }, [triggerSplash]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setTimeStr(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSplashComplete = React.useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleGrantPermissions = React.useCallback(() => {
    localStorage.setItem('lifeline_mesh_permissions', 'granted');
    setHasMeshPermissions(true);
  }, []);

  const handleLanguageSelected = React.useCallback(() => {
    setHasSelectedLanguage(true);
  }, []);

  // 1. SPLASH SCREEN
  if (showSplash) {
    return (
      <div className="smartphone-chassis">
        <div className="phone-top-bar" style={{ zIndex: 10000 }}>
          <span>{timeStr}</span>
          <div className="phone-dynamic-island">
            <div className="island-camera-lens"></div>
            <div className="island-sensor"></div>
          </div>
          <span>5G • 94%</span>
        </div>
        <SplashScreen onComplete={handleSplashComplete} durationMs={2800} />
      </div>
    );
  }

  // 2. MANDATORY BLUETOOTH & WI-FI PERMISSION POPUP
  if (!hasMeshPermissions) {
    return (
      <div className="smartphone-chassis">
        <div className="phone-top-bar" style={{ zIndex: 10000 }}>
          <span>{timeStr}</span>
          <div className="phone-dynamic-island">
            <div className="island-camera-lens"></div>
            <div className="island-sensor"></div>
          </div>
          <span>5G • 90%</span>
        </div>
        <BluetoothWifiPermissionModal onGrantPermissions={handleGrantPermissions} />
      </div>
    );
  }

  // 3. LANGUAGE SELECTION SCREEN
  if (!hasSelectedLanguage) {
    return (
      <div className="smartphone-chassis">
        <div className="phone-top-bar">
          <span>{timeStr}</span>
          <div className="phone-dynamic-island">
            <div className="island-camera-lens"></div>
            <div className="island-sensor"></div>
          </div>
          <span>5G • 89%</span>
        </div>
        <div className="phone-screen-content" style={{ paddingBottom: 0 }}>
          <LanguageSelectionScreen onLanguageSelected={handleLanguageSelected} />
        </div>
      </div>
    );
  }

  // 4. LOGIN SCREEN (PEOPLE / OFFICIAL)
  if (!user) {
    return (
      <div className="smartphone-chassis">
        <div className="phone-status-bar">
          <span>{timeStr}</span>
          <div className="phone-dynamic-island" />
          <span style={{ fontSize: 11, color: '#475569' }}>94%</span>
        </div>
        <div className="mobile-screen-body" style={{ paddingBottom: 0 }}>
          <LoginScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="smartphone-chassis">
      {/* Phone Status Bar */}
      <div className="phone-status-bar">
        <span>{timeStr}</span>
        <div className="phone-dynamic-island" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {syncPending && <RefreshCw size={12} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />}
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: activeRole === 'VICTIM' ? '#16A34A' : '#2563EB',
            background: activeRole === 'VICTIM' ? '#F0FDF4' : '#EFF6FF',
            padding: '2px 8px',
            borderRadius: 10
          }}>
            {activeRole === 'VICTIM' ? '● SOS READY' : 'HQ ACTIVE'}
          </span>
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3
            }}
            title="Logout of Lifeline"
          >
            <LogOut size={10} />
            <span>LOGOUT</span>
          </button>
        </div>
      </div>

      {/* Role Switcher Pill Bar - ONLY visible for Official accounts */}
      {!forcedRole && isOfficialUser && (
        <div
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div className="role-switcher-group" style={{ flex: 1 }}>
            <button
              className={`role-switch-btn ${activeRole === 'VICTIM' ? 'active' : ''}`}
              onClick={() => setRole('VICTIM')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Smartphone size={14} />
              <span>{t('roleVictimTitle')}</span>
            </button>
            <button
              className={`role-switch-btn ${activeRole === 'RESCUE_TEAM' ? 'active' : ''}`}
              onClick={() => setRole('RESCUE_TEAM')}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Shield size={14} />
              <span>{t('roleRescueTitle')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Screen Content Body */}
      <div className="mobile-screen-body">
        {activeRole === 'VICTIM' ? (
          /* CIVILIAN / VICTIM VIEWS */
          victimTab === 'HOME' ? (
            <VictimHome
              onNavigateToMap={() => setVictimTab('MAP')}
              onNavigateToMessages={() => setVictimTab('MESSAGES')}
              onNavigateToMesh={() => setVictimTab('MESH')}
              onInspectPacket={(id) => {
                setInspectedSosId(id);
                setVictimTab('HOME');
              }}
            />
          ) : victimTab === 'MESH' ? (
            <MeshRadar onBack={() => setVictimTab('HOME')} />
          ) : victimTab === 'MAP' ? (
            <TacticalMap isRescueView={false} />
          ) : victimTab === 'MESSAGES' ? (
            <EmergencyChat onBack={() => setVictimTab('HOME')} />
          ) : (
            /* Account Info View */
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{t('navProfile')}</h2>

              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}
              >
                <div>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Name:</span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{user.name}</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: '#64748B' }}>User ID / Account:</span>
                  <div style={{ fontSize: 14, fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>{user.userId}</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Phone / Emergency Contact:</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{user.emergencyContact || 'Not provided'}</div>
                </div>
              </div>

              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{t('language')}</span>
                <LanguageSelector />
              </div>

              {/* Technical Telemetry & Diagnostics */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 14,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 800, color: '#0F172A', fontSize: 12, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={15} color="#2563EB" />
                    HARDWARE & TELEMETRY DIAGNOSTICS
                  </span>
                  <span style={{ fontSize: 10, background: '#F0FDF4', color: '#16A34A', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Raw GPS Coordinates:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>GPS Precision:</span>
                  <strong style={{ color: '#2563EB' }}>±{location.accuracy} meters</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Cellular Network:</span>
                  <strong style={{ color: '#DC2626' }}>OFFLINE (Tower Failure)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Mesh Network Engine:</span>
                  <strong style={{ color: '#16A34A' }}>Store-Carry-Forward P2P</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Battery State:</span>
                  <strong style={{ color: '#D97706' }}>85% • Low Power Mode</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Cryptography:</span>
                  <strong style={{ color: '#2563EB' }}>AES-GCM + HMAC-SHA256</strong>
                </div>
              </div>

              {/* Install APK / Real Phone Button */}
              <button
                type="button"
                onClick={() => setShowInstallModal(true)}
                style={{
                  height: 48,
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#2563EB',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <Smartphone size={16} />
                <span>Install APK on Android Phone</span>
              </button>

              <button
                type="button"
                onClick={syncWithCloud}
                style={{
                  height: 48,
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  color: '#0F172A',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <RefreshCw size={16} />
                <span>{syncPending ? 'Syncing Data...' : 'Sync Data Offline/Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                style={{
                  height: 48,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <LogOut size={16} />
                <span>{t('switchRole')} / Logout</span>
              </button>

              {showInstallModal && (
                <InstallOnPhoneModal onClose={() => setShowInstallModal(false)} />
              )}
            </div>
          )
        ) : (
          /* RESCUER VIEWS */
          rescueTab === 'DASHBOARD' ? (
            <RescueDashboard
              onNavigateToMap={() => setRescueTab('MAP')}
              selectedSosIdForDetail={inspectedSosId}
              onClearSelectedDetail={() => setInspectedSosId(null)}
            />
          ) : rescueTab === 'MAP' ? (
            <TacticalMap
              isRescueView={true}
              onSelectSos={(id) => {
                setInspectedSosId(id);
                setRescueTab('DASHBOARD');
              }}
            />
          ) : (
            <MeshRadar />
          )
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="bottom-nav-bar">
        {activeRole === 'VICTIM' ? (
          <>
            <button
              className={`nav-tab-btn ${victimTab === 'HOME' ? 'active' : ''}`}
              onClick={() => setVictimTab('HOME')}
            >
              <div className="nav-icon-box">
                <Home size={20} />
              </div>
              <span>{t('navHome')}</span>
            </button>

            <button
              className={`nav-tab-btn ${victimTab === 'MAP' ? 'active' : ''}`}
              onClick={() => setVictimTab('MAP')}
            >
              <div className="nav-icon-box">
                <Map size={20} />
              </div>
              <span>{t('navMap')}</span>
            </button>

            <button
              className={`nav-tab-btn ${victimTab === 'MESSAGES' ? 'active' : ''}`}
              onClick={() => setVictimTab('MESSAGES')}
            >
              <div className="nav-icon-box">
                <MessageSquare size={20} />
              </div>
              <span>{t('navChat')}</span>
            </button>

            <button
              className={`nav-tab-btn ${victimTab === 'MESH' ? 'active' : ''}`}
              onClick={() => setVictimTab('MESH')}
            >
              <div className="nav-icon-box">
                <Radio size={20} />
              </div>
              <span>{t('navRadar')}</span>
            </button>

            <button
              className={`nav-tab-btn ${victimTab === 'PROFILE' ? 'active' : ''}`}
              onClick={() => setVictimTab('PROFILE')}
            >
              <div className="nav-icon-box">
                <User size={20} />
              </div>
              <span>{t('navProfile')}</span>
            </button>
          </>
        ) : (
          /* Rescue Team Navigation: Dashboard | Live Map | Mesh | Logout */
          <>
            <button
              className={`nav-tab-btn ${rescueTab === 'DASHBOARD' ? 'active' : ''}`}
              onClick={() => setRescueTab('DASHBOARD')}
            >
              <div className="nav-icon-box">
                <Home size={20} />
              </div>
              <span>{t('navDashboard')}</span>
            </button>

            <button
              className={`nav-tab-btn ${rescueTab === 'MAP' ? 'active' : ''}`}
              onClick={() => setRescueTab('MAP')}
            >
              <div className="nav-icon-box">
                <Map size={20} />
              </div>
              <span>{t('navMap')}</span>
            </button>

            <button
              className={`nav-tab-btn ${rescueTab === 'MESH' ? 'active' : ''}`}
              onClick={() => setRescueTab('MESH')}
            >
              <div className="nav-icon-box">
                <Radio size={20} />
              </div>
              <span>{t('navRadar')}</span>
            </button>

            <button
              className="nav-tab-btn"
              onClick={() => setShowLogoutModal(true)}
            >
              <div className="nav-icon-box">
                <LogOut size={20} color="#DC2626" />
              </div>
              <span style={{ color: '#DC2626' }}>Logout</span>
            </button>
          </>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Emergency Red Area SOS Alert Popup Modal */}
      {redZoneSosPopup && (
        <RedZoneEmergencyModal
          packet={redZoneSosPopup}
          onClose={() => setRedZoneSosPopup(null)}
          onViewOnMap={() => {
            if (activeRole === 'VICTIM') setVictimTab('MAP');
            else setRescueTab('MAP');
          }}
          onViewMesh={() => {
            if (activeRole === 'VICTIM') setVictimTab('MESH');
            else setRescueTab('MESH');
          }}
        />
      )}
    </div>
  );
};

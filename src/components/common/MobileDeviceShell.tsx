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
import {
  Home,
  Map,
  MessageSquare,
  AlertOctagon,
  Settings,
  Radio,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Smartphone,
  ShieldAlert
} from 'lucide-react';

interface Props {
  forcedRole?: 'VICTIM' | 'RESCUE_TEAM';
  deviceTitle?: string;
  triggerSplash?: boolean;
}

type VictimTab = 'HOME' | 'MESH' | 'MAP' | 'MESSAGES' | 'SOS' | 'PROFILE';
type RescueTab = 'DASHBOARD' | 'MAP' | 'SOS' | 'MESH';

export const MobileDeviceShell: React.FC<Props> = ({ forcedRole, deviceTitle, triggerSplash }) => {
  const { user, role: contextRole, setRole, logout, syncPending, syncWithCloud, redZoneSosPopup, setRedZoneSosPopup, location } = useApp();
  
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
    const t = setInterval(() => {
      const d = new Date();
      setTimeStr(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    }, 10000);
    return () => clearInterval(t);
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
        <div className="phone-top-bar">
          <span>{timeStr}</span>
          <div className="phone-dynamic-island">
            <div className="island-camera-lens"></div>
            <div className="island-sensor"></div>
          </div>
          <span>5G • 88%</span>
        </div>
        <div className="phone-screen-content" style={{ paddingBottom: 0 }}>
          <LoginScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="smartphone-chassis">
      {/* Phone Hardware Top Status Bar */}
      <div className="phone-top-bar">
        <span>{timeStr}</span>
        <div className="phone-dynamic-island">
          <div className="island-camera-lens"></div>
          <div className="island-sensor"></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {syncPending && (
            <RefreshCw size={11} className="animate-spin" color="#38BDF8" />
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: activeRole === 'VICTIM' ? '#10B981' : '#38BDF8' }}>
            {activeRole === 'VICTIM' ? '● SOS READY' : 'TACTICAL-HQ'}
          </span>
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#FCA5A5',
              borderRadius: 6,
              padding: '2px 7px',
              fontSize: 9,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              marginLeft: 2,
              letterSpacing: '0.4px'
            }}
            title="Logout of Lifeline"
          >
            <LogOut size={10} />
            <span>LOGOUT</span>
          </button>
        </div>
      </div>

      {/* Top Role Switcher Header inside Mobile Section - ONLY visible for Official accounts */}
      {!forcedRole && isOfficialUser && (
        <div className="phone-role-switcher-bar">
          <div className="role-switcher-group">
            <button
              className={`role-tab-btn ${activeRole === 'VICTIM' ? 'active' : ''}`}
              onClick={() => setRole('VICTIM')}
            >
              <Smartphone size={13} />
              <span>Victim Phone</span>
            </button>
            <button
              className={`role-tab-btn rescue ${activeRole === 'RESCUE_TEAM' ? 'active rescue' : ''}`}
              onClick={() => setRole('RESCUE_TEAM')}
            >
              <ShieldAlert size={13} />
              <span>Rescue Center</span>
            </button>
          </div>
        </div>
      )}

      {/* Screen Body */}
      <div className="phone-screen-content">
        {activeRole === 'VICTIM' ? (
          /* ================= VICTIM SCREENS ================= */
          victimTab === 'HOME' ? (
            <VictimHome
              onNavigateToMap={() => setVictimTab('MAP')}
              onNavigateToMessages={() => setVictimTab('MESSAGES')}
              onNavigateToMesh={() => setVictimTab('MESH')}
              onInspectPacket={(id) => {
                setInspectedSosId(id);
                setVictimTab('SOS');
              }}
            />
          ) : victimTab === 'MESH' ? (
            <MeshRadar onBack={() => setVictimTab('HOME')} />
          ) : victimTab === 'MAP' ? (
            <TacticalMap isRescueView={false} />
          ) : victimTab === 'MESSAGES' ? (
            <EmergencyChat onBack={() => setVictimTab('HOME')} />
          ) : victimTab === 'SOS' ? (
            <VictimHome
              onNavigateToMap={() => setVictimTab('MAP')}
              onNavigateToMessages={() => setVictimTab('MESSAGES')}
              onNavigateToMesh={() => setVictimTab('MESH')}
            />
          ) : (
            /* Profile & System Info */
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFF' }}>⚙ VICTIM PROFILE</h2>
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 14,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 12
              }}>
                <div>Name: <strong style={{ color: '#FFF' }}>{user.name}</strong></div>
                <div>User ID: <strong style={{ color: '#FFF' }}>{user.userId}</strong></div>
                <div>Device ID: <strong style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{user.phoneId}</strong></div>
                <div>Emergency Contact: <strong style={{ color: '#FFF' }}>{user.emergencyContact || 'None listed'}</strong></div>
              </div>

              {/* Technical Telemetry & Diagnostics (Preserved from Home Screen) */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 14,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
                  <span style={{ fontWeight: 800, color: '#38BDF8', fontSize: 11, letterSpacing: 0.8 }}>
                    🛠️ TECHNICAL & HARDWARE DIAGNOSTICS
                  </span>
                  <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>Raw GPS Coordinates:</span>
                  <strong style={{ color: '#FFF', fontFamily: 'monospace' }}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>GPS Precision:</span>
                  <strong style={{ color: '#38BDF8' }}>±{location.accuracy} meters</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>Cellular Network:</span>
                  <strong style={{ color: '#EF4444' }}>OFFLINE (Tower Failure)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>Mesh Network Engine:</span>
                  <strong style={{ color: '#10B981' }}>Store-Carry-Forward P2P</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>Battery State:</span>
                  <strong style={{ color: '#F59E0B' }}>88% • Low Power Mode</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8' }}>
                  <span>Cryptography:</span>
                  <strong style={{ color: '#38BDF8' }}>AES-GCM + HMAC-SHA256</strong>
                </div>
              </div>

              <button
                onClick={syncWithCloud}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38BDF8',
                  padding: '12px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <RefreshCw size={15} />
                <span>{syncPending ? 'Syncing...' : 'Sync Stored Data to Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  padding: '12px',
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <LogOut size={15} />
                <span>Logout / Switch Account</span>
              </button>
            </div>
          )
        ) : (
          /* ================= RESCUE TEAM SCREENS ================= */
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
          ) : rescueTab === 'SOS' ? (
            <RescueDashboard
              onNavigateToMap={() => setRescueTab('MAP')}
            />
          ) : (
            <MeshRadar />
          )
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="phone-bottom-nav">
        {activeRole === 'VICTIM' ? (
          /* Victim Navigation: Home | Map | Messages | SOS | Profile */
          <>
            <button
              className={`nav-item-btn ${victimTab === 'HOME' ? 'active' : ''}`}
              onClick={() => setVictimTab('HOME')}
            >
              <Home size={18} />
              <span>Home</span>
            </button>

            <button
              className={`nav-item-btn ${victimTab === 'MESH' ? 'active' : ''}`}
              onClick={() => setVictimTab('MESH')}
            >
              <Radio size={18} />
              <span>Mesh</span>
            </button>

            <button
              className={`nav-item-btn ${victimTab === 'SOS' ? 'active sos-glow' : 'sos-glow'}`}
              onClick={() => setVictimTab('HOME')}
            >
              <AlertOctagon size={20} color="#EF4444" />
              <span style={{ color: '#EF4444', fontWeight: 800 }}>SOS</span>
            </button>

            <button
              className={`nav-item-btn ${victimTab === 'MAP' ? 'active' : ''}`}
              onClick={() => setVictimTab('MAP')}
            >
              <Map size={18} />
              <span>Map</span>
            </button>

            <button
              className={`nav-item-btn ${victimTab === 'PROFILE' ? 'active' : ''}`}
              onClick={() => setVictimTab('PROFILE')}
            >
              <Settings size={18} />
              <span>Account</span>
            </button>
          </>
        ) : (
          /* Rescue Team Navigation: Dashboard | Live Map | SOS | Mesh | Logout */
          <>
            <button
              className={`nav-item-btn ${rescueTab === 'DASHBOARD' ? 'active' : ''}`}
              onClick={() => setRescueTab('DASHBOARD')}
            >
              <Home size={18} />
              <span>Dashboard</span>
            </button>

            <button
              className={`nav-item-btn ${rescueTab === 'MAP' ? 'active' : ''}`}
              onClick={() => setRescueTab('MAP')}
            >
              <Map size={18} />
              <span>Live Map</span>
            </button>

            <button
              className={`nav-item-btn ${rescueTab === 'SOS' ? 'active sos-glow' : 'sos-glow'}`}
              onClick={() => setRescueTab('DASHBOARD')}
            >
              <AlertOctagon size={20} color="#EF4444" />
              <span style={{ color: '#EF4444', fontWeight: 800 }}>SOS Queue</span>
            </button>

            <button
              className={`nav-item-btn ${rescueTab === 'MESH' ? 'active' : ''}`}
              onClick={() => setRescueTab('MESH')}
            >
              <Radio size={18} />
              <span>Mesh</span>
            </button>

            <button
              className="nav-item-btn"
              onClick={() => setShowLogoutModal(true)}
            >
              <LogOut size={18} color="#EF4444" />
              <span style={{ color: '#EF4444' }}>Logout</span>
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
            if (activeRole === 'VICTIM') {
              setVictimTab('MAP');
            } else {
              setRescueTab('MAP');
            }
          }}
          onViewMesh={() => {
            if (activeRole === 'VICTIM') {
              setVictimTab('MESH');
            } else {
              setRescueTab('MESH');
            }
          }}
        />
      )}
    </div>
  );
};

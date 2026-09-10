import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { VictimHome } from '../victim/VictimHome';
import { EmergencyChat } from '../victim/EmergencyChat';
import { MeshRadar } from '../victim/MeshRadar';
import { TacticalMap } from '../map/TacticalMap';
import { RescueDashboard } from '../rescue/RescueDashboard';
import { LoginScreen } from '../auth/LoginScreen';
import { RedZoneEmergencyModal } from './RedZoneEmergencyModal';
import { LanguageSelector } from './LanguageSelector';
import {
  Home,
  Map,
  MessageSquare,
  AlertTriangle,
  Radio,
  User,
  LogOut,
  RefreshCw,
  Smartphone,
  Shield
} from 'lucide-react';

interface Props {
  forcedRole?: 'VICTIM' | 'RESCUE_TEAM';
  deviceTitle?: string;
}

type VictimTab = 'HOME' | 'MESH' | 'MAP' | 'MESSAGES' | 'PROFILE';
type RescueTab = 'DASHBOARD' | 'MAP' | 'MESH';

export const MobileDeviceShell: React.FC<Props> = ({ forcedRole }) => {
  const { user, role: contextRole, setRole, logout, syncPending, syncWithCloud, redZoneSosPopup, setRedZoneSosPopup, t } = useApp();
  const activeRole = forcedRole || contextRole;

  // Active Tab states
  const [victimTab, setVictimTab] = useState<VictimTab>('HOME');
  const [rescueTab, setRescueTab] = useState<RescueTab>('DASHBOARD');
  const [inspectedSosId, setInspectedSosId] = useState<string | null>(null);

  // Time state for status bar
  const [timeStr, setTimeStr] = useState(() => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setTimeStr(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {syncPending && <RefreshCw size={12} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />}
          <span style={{ fontSize: 11, color: '#475569' }}>94%</span>
        </div>
      </div>

      {/* Role Switcher Pill Bar (Top of Phone Screen) */}
      {!forcedRole && (
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
              onInspectPacket={() => setVictimTab('HOME')}
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
                  <span style={{ fontSize: 12, color: '#64748B' }}>User ID:</span>
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

              <button
                onClick={syncWithCloud}
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
                <RefreshCw size={16} />
                <span>{syncPending ? 'Syncing Data...' : 'Sync Data Offline/Cloud'}</span>
              </button>

              <button
                onClick={logout}
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
          </>
        )}
      </div>

      {/* Emergency Red Area SOS Alert Modal */}
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

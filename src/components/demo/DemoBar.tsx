import React, { useState } from 'react';
import { Smartphone, Monitor, Columns, ShieldAlert } from 'lucide-react';
import { InstallOnPhoneModal } from '../common/InstallOnPhoneModal';
import { useApp } from '../../context/AppContext';

export type ViewMode = 'phone' | 'desktop' | 'dual';

interface Props {
  viewMode?: ViewMode;
  onSelectViewMode?: (mode: ViewMode) => void;
  onReplaySplash?: () => void;
}

export const DemoBar: React.FC<Props> = ({
  viewMode = 'phone',
  onSelectViewMode,
  onReplaySplash
}) => {
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const { role, setRole } = useApp();

  return (
    <div className="demo-presentation-bar">
      {/* Left / Brand Info */}
      <div className="demo-title-group">
        <div className="demo-badge">LIFELINE MESH</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>
          Offline Disaster Network
        </span>
      </div>

      {/* Center: View Switcher (Laptop / Desktop Only) */}
      {onSelectViewMode && (
        <div className="laptop-view-switcher">
          <button
            className={`view-mode-btn ${viewMode === 'phone' ? 'active' : ''}`}
            onClick={() => onSelectViewMode('phone')}
            title="Mobile Phone View (fits laptop screen)"
          >
            <Smartphone size={13} />
            <span>Mobile Frame</span>
          </button>

          <button
            className={`view-mode-btn ${viewMode === 'desktop' ? 'active' : ''}`}
            onClick={() => {
              setRole('RESCUE_TEAM');
              onSelectViewMode('desktop');
            }}
            title="Desktop Tactical Incident Command Dashboard"
          >
            <Monitor size={13} />
            <span>Incident Command HQ</span>
          </button>

          <button
            className={`view-mode-btn ${viewMode === 'dual' ? 'active' : ''}`}
            onClick={() => onSelectViewMode('dual')}
            title="Side-by-side Dual View (Victim Phone + Rescue Command)"
          >
            <Columns size={13} />
            <span>Dual View</span>
          </button>
        </div>
      )}

      {/* Right: Install APK / Phone Button & Replay Splash */}
      <div className="presentation-actions">
        {onReplaySplash && (
          <button
            className="pres-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#F8FAFC',
              fontWeight: 700,
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
            onClick={onReplaySplash}
            title="Preview the futuristic mobile splash screen animation"
          >
            <span>✨ Splash Screen</span>
          </button>
        )}
        <button
          className="pres-btn"
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.3))',
            border: '1px solid #38BDF8',
            color: '#38BDF8',
            fontWeight: 800,
            fontSize: 12,
            padding: '6px 16px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.2)',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setShowInstallModal(true)}
          title="Install and run this app on a real Android phone"
        >
          <Smartphone size={14} color="#38BDF8" />
          <span>📲 Install on Phone</span>
        </button>
      </div>

      {showInstallModal && (
        <InstallOnPhoneModal onClose={() => setShowInstallModal(false)} />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { InstallOnPhoneModal } from '../common/InstallOnPhoneModal';

interface Props {
  isDualView?: boolean;
  onToggleDualView?: () => void;
}

export const DemoBar: React.FC<Props> = () => {
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  return (
    <div
      className="demo-presentation-bar"
      style={{
        justifyContent: 'center',
        padding: '8px 16px',
        marginBottom: '10px'
      }}
    >
      {/* Install APK / Phone Button Only */}
      <button
        className="pres-btn"
        style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.3))',
          border: '1px solid #38BDF8',
          color: '#38BDF8',
          fontWeight: 800,
          fontSize: 13,
          padding: '8px 22px',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          boxShadow: '0 0 15px rgba(56, 189, 248, 0.25)',
          transition: 'all 0.2s ease'
        }}
        onClick={() => setShowInstallModal(true)}
        title="Install and run this app on a real Android phone"
      >
        <Smartphone size={16} color="#38BDF8" />
        <span>📲 Install APK / Phone</span>
      </button>

      {showInstallModal && (
        <InstallOnPhoneModal onClose={() => setShowInstallModal(false)} />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { InstallOnPhoneModal } from '../common/InstallOnPhoneModal';
import { LanguageSelector } from '../common/LanguageSelector';
import { useApp } from '../../context/AppContext';

export const DemoBar: React.FC = () => {
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const { t } = useApp();

  return (
    <div
      className="demo-presentation-bar"
      style={{
        justifyContent: 'space-between',
        padding: '8px 16px',
        marginBottom: '10px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>
          {t('appName')}
        </span>
        <span className="demo-badge">{t('statusMeshReady')}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Single top-level Language Selector */}
        <LanguageSelector compact />

        {/* Install APK / Phone Button */}
        <button
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#2563EB',
            fontWeight: 700,
            fontSize: 12,
            padding: '6px 14px',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => setShowInstallModal(true)}
          title="Install and run this app on a real Android phone"
        >
          <Smartphone size={14} color="#2563EB" />
          <span>Install APK</span>
        </button>
      </div>

      {showInstallModal && (
        <InstallOnPhoneModal onClose={() => setShowInstallModal(false)} />
      )}
    </div>
  );
};

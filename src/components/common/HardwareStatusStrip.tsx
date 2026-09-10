import React from 'react';
import { useApp } from '../../context/AppContext';
import { WifiOff, Wifi, Radio, Navigation, BatteryCharging } from 'lucide-react';

export const HardwareStatusStrip: React.FC = () => {
  const { isInternetDown, meshStatus, location, setIsInternetDown, t } = useApp();

  return (
    <div className="hardware-status-strip">
      {/* Cellular / Internet status */}
      <div
        className="hardware-pill"
        onClick={() => setIsInternetDown(!isInternetDown)}
        title="Tap to toggle cellular simulation"
        style={{ cursor: 'pointer' }}
      >
        {isInternetDown ? (
          <>
            <WifiOff size={14} color="#DC2626" />
            <span style={{ color: '#DC2626' }}>{t('statusInternetOff')}</span>
          </>
        ) : (
          <>
            <Wifi size={14} color="#16A34A" />
            <span style={{ color: '#16A34A' }}>{t('statusInternetOn')}</span>
          </>
        )}
      </div>

      {/* GPS Status */}
      <div className="hardware-pill">
        <Navigation size={14} color="#16A34A" />
        <span style={{ color: '#0F172A' }}>GPS ±{location.accuracy}m</span>
      </div>

      {/* Mesh Radio Status */}
      <div className="hardware-pill">
        <Radio
          size={14}
          color={meshStatus === 'CONNECTED' ? '#16A34A' : meshStatus === 'SEARCHING' ? '#D97706' : '#DC2626'}
        />
        <span style={{
          color: meshStatus === 'CONNECTED' ? '#16A34A' : meshStatus === 'SEARCHING' ? '#D97706' : '#DC2626'
        }}>
          {t('statusMeshReady')}
        </span>
      </div>

      {/* Battery */}
      <div className="hardware-pill">
        <BatteryCharging size={14} color="#64748B" />
        <span>85%</span>
      </div>
    </div>
  );
};

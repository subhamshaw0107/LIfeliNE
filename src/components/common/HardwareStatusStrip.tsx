import React from 'react';
import { useApp } from '../../context/AppContext';
import { WifiOff, Wifi, Radio, Navigation, BatteryCharging } from 'lucide-react';

export const HardwareStatusStrip: React.FC = () => {
  const { isInternetDown, meshStatus, location, setIsInternetDown, realPeerIds, isNative, isGpsReal, deviceBattery, t } = useApp();

  // Truthful mesh text: peer count comes from REAL BLE state on native,
  // demo mesh state in browser. Never claims a connection with 0 peers.
  const peerCount = isNative ? realPeerIds.length : null;
  const meshLabel =
    meshStatus === 'CONNECTED'
      ? peerCount === null ? t('statusMeshReady') : `Mesh Active • ${peerCount} peer${peerCount === 1 ? '' : 's'}`
      : meshStatus === 'SEARCHING'
        ? t('statusMeshSearching')
        : t('statusMeshOffline');
  const meshColor = meshStatus === 'CONNECTED' ? '#16A34A' : meshStatus === 'SEARCHING' ? '#D97706' : '#DC2626';

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

      {/* GPS Status — provenance explicit: REAL fix vs pending/demo */}
      <div className="hardware-pill">
        <Navigation size={14} color={isGpsReal ? '#16A34A' : '#D97706'} />
        <span style={{ color: isGpsReal ? '#0F172A' : '#D97706' }}>
          {isGpsReal ? `${t('statusGpsReal')} ±${location.accuracy}m` : t('statusGpsPending')}
        </span>
      </div>

      {/* Mesh Radio Status — text reflects state, never a static claim */}
      <div className="hardware-pill">
        <Radio
          size={14}
          color={meshColor}
        />
        <span style={{
          color: meshColor
        }}>
          {meshLabel}
        </span>
      </div>

      {/* Battery — real reading or explicit unknown, never a fake fixed % */}
      <div className="hardware-pill">
        <BatteryCharging size={14} color="#64748B" />
        <span>{deviceBattery === null ? t('batteryUnknown') : `${deviceBattery}%`}</span>
      </div>
    </div>
  );
};


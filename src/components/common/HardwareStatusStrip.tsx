import React from 'react';
import { useApp } from '../../context/AppContext';
import { WifiOff, Wifi, Radio, Navigation, BatteryCharging } from 'lucide-react';

export const HardwareStatusStrip: React.FC = () => {
  const { isInternetDown, meshStatus, location, setIsInternetDown, isGpsReal, isNative } = useApp();

  return (
    <div className="hardware-status-strip">
      {/* Cellular / Internet status */}
      <div 
        className="status-pill cursor-pointer" 
        onClick={() => setIsInternetDown(!isInternetDown)}
        title="Click to toggle Internet/Cellular connection"
        style={{ cursor: 'pointer' }}
      >
        {isInternetDown ? (
          <>
            <WifiOff size={13} color="#EF4444" />
            <span style={{ color: '#EF4444' }}>NET: OFF</span>
          </>
        ) : (
          <>
            <Wifi size={13} color="#10B981" />
            <span style={{ color: '#10B981' }}>NET: 4G</span>
          </>
        )}
      </div>

      {/* GPS Status */}
      <div className="status-pill">
        <Navigation size={13} color={isGpsReal ? '#10B981' : '#F59E0B'} />
        <span style={{ color: isGpsReal ? '#10B981' : '#F59E0B' }}>
          {isGpsReal ? `GPS ±${location.accuracy}m` : (isNative ? 'GPS: PENDING' : 'GPS: DEMO')}
        </span>
      </div>

      {/* Mesh Radio Status */}
      <div className="status-pill">
        <Radio 
          size={13} 
          color={meshStatus === 'CONNECTED' ? '#10B981' : meshStatus === 'SEARCHING' ? '#F59E0B' : '#EF4444'} 
        />
        <span style={{
          color: meshStatus === 'CONNECTED' ? '#10B981' : meshStatus === 'SEARCHING' ? '#F59E0B' : '#EF4444'
        }}>
          MESH: {meshStatus}
        </span>
      </div>

      {/* Battery */}
      <div className="status-pill" style={{ opacity: 0.8 }}>
        <BatteryCharging size={13} color="#94A3B8" />
        <span>79%</span>
      </div>
    </div>
  );
};

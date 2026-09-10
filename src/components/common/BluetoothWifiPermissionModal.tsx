import React, { useState } from 'react';
import { Bluetooth, Wifi, ShieldAlert, CheckCircle2, Radio, Lock } from 'lucide-react';

interface Props {
  onGrantPermissions: () => void;
}

export const BluetoothWifiPermissionModal: React.FC<Props> = ({ onGrantPermissions }) => {
  const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleEnableAndContinue = () => {
    setIsAuthorizing(true);
    setTimeout(() => {
      onGrantPermissions();
    }, 400);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(4, 7, 17, 0.96)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 18px',
        color: '#FFF',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      {/* Background Star Ambient */}
      <div className="splash-stars-bg" />

      {/* Main Glass Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          minWidth: 'min(100%, 300px)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(9, 14, 28, 0.98) 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '24px',
          padding: '24px 20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Animated Radio Beacon Radar Icon */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '20px',
              background: 'linear-gradient(145deg, #1E293B, #0F172A)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              boxShadow: '0 0 25px rgba(56, 189, 248, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8'
            }}
          >
            <Radio size={30} className="animate-pulse" />
          </div>
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#EF4444',
              border: '2px solid #0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF'
            }}
          >
            <ShieldAlert size={12} />
          </div>
        </div>

        {/* Modal Category Badge */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '1.5px',
            color: '#38BDF8',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '3px 10px',
            borderRadius: '20px',
            textTransform: 'uppercase',
            marginBottom: 8
          }}
        >
          Mandatory Hardware Access
        </div>

        {/* Modal Title */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: '0.5px',
            color: '#FFFFFF',
            margin: '0 0 6px 0'
          }}
        >
          TURN ON BLUETOOTH & WI-FI
        </h2>

        {/* Explanation */}
        <p
          style={{
            fontSize: 12,
            color: '#94A3B8',
            lineHeight: 1.5,
            margin: '0 0 20px 0'
          }}
        >
          Lifeline operates on an <strong style={{ color: '#E2E8F0' }}>offline store-carry-forward disaster mesh network</strong>. Bluetooth and Wi-Fi are strictly mandatory to discover nearby survivors and relay emergency SOS packets when cellular towers and internet are down.
        </p>

        {/* Radio Toggles List */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {/* Bluetooth Radio Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(4, 7, 17, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '12px 14px',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Bluetooth size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>
                  Bluetooth Low Energy (BLE)
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                  Nearby peer discovery & packet hop
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBluetoothEnabled(!bluetoothEnabled)}
              style={{
                width: 44,
                height: 24,
                borderRadius: '12px',
                background: bluetoothEnabled ? '#10B981' : '#334155',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                flexShrink: 0
              }}
              title="Toggle Bluetooth"
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  position: 'absolute',
                  top: 3,
                  left: bluetoothEnabled ? 23 : 3,
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                }}
              />
            </button>
          </div>

          {/* Wi-Fi Direct Radio Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(4, 7, 17, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '12px 14px',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Wifi size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>
                  Wi-Fi Direct / Local Radio
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                  High-speed offline payload transfer
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWifiEnabled(!wifiEnabled)}
              style={{
                width: 44,
                height: 24,
                borderRadius: '12px',
                background: wifiEnabled ? '#10B981' : '#334155',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                flexShrink: 0
              }}
              title="Toggle Wi-Fi"
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  position: 'absolute',
                  top: 3,
                  left: wifiEnabled ? 23 : 3,
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                }}
              />
            </button>
          </div>
        </div>

        {/* Security / Offline Assurance Note */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 10,
            color: '#64748B',
            marginBottom: 20,
            textAlign: 'left'
          }}
        >
          <Lock size={13} color="#38BDF8" style={{ flexShrink: 0 }} />
          <span>Zero cellular data or internet needed. Hardware radios are used strictly for local peer-to-peer survival packets.</span>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleEnableAndContinue}
          disabled={!bluetoothEnabled || !wifiEnabled || isAuthorizing}
          style={{
            width: '100%',
            background: (!bluetoothEnabled || !wifiEnabled)
              ? '#334155'
              : 'linear-gradient(135deg, #0284C7, #0369A1)',
            border: 'none',
            borderRadius: '14px',
            padding: '14px 18px',
            color: (!bluetoothEnabled || !wifiEnabled) ? '#94A3B8' : '#FFFFFF',
            fontSize: '13px',
            fontWeight: 800,
            letterSpacing: '1px',
            cursor: (!bluetoothEnabled || !wifiEnabled || isAuthorizing) ? 'not-allowed' : 'pointer',
            boxShadow: (!bluetoothEnabled || !wifiEnabled)
              ? 'none'
              : '0 6px 20px rgba(2, 132, 199, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease'
          }}
        >
          <CheckCircle2 size={18} />
          <span>{isAuthorizing ? 'CONNECTING MESH RADIOS...' : 'ENABLE & ALLOW OFFLINE MESH'}</span>
        </button>

        {(!bluetoothEnabled || !wifiEnabled) && (
          <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, marginTop: 8 }}>
            ⚠️ Both Bluetooth and Wi-Fi must be enabled to connect to the mesh.
          </div>
        )}
      </div>
    </div>
  );
};

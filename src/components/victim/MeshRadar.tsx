import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { BleDiagnosticsPanel } from '../common/BleDiagnosticsPanel';
import { Radio, ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

export const MeshRadar: React.FC<Props> = ({ onBack }) => {
  const { meshNodes, meshStatus, user, toggleSimulateNodeRange, realPeerIds, isNative, t } = useApp();
  const [isNodeInRange, setIsNodeInRange] = useState(true);

  const isBleMode = realPeerIds.length > 0;

  const handleToggleRange = () => {
    const res = toggleSimulateNodeRange();
    setIsNodeInRange(res);
  };

  const realHops = [
    {
      id: 'LOCAL-DEVICE',
      title: `YOU (${user?.phoneId || 'DEV'})`,
      sub: 'This device',
      status: 'SOURCE',
      dist: '0.0 km',
      inRange: true
    },
    ...realPeerIds.map((peerId) => ({
      id: peerId,
      title: peerId,
      sub: 'BLE peer • connected',
      status: 'CONNECTED',
      dist: 'N/A',
      inRange: true
    }))
  ];

  const demoHops = [
    {
      id: 'PERSON_A',
      title: 'PERSON A',
      sub: `You (${user?.phoneId || 'DEV-A8F31C'})`,
      status: 'SOURCE',
      dist: '0.0 km',
      inRange: true
    },
    {
      id: 'NODE-PERSON-B',
      title: 'PERSON B',
      sub: 'Nearby Citizen Relay',
      status: 'AUTO-RELAY',
      dist: `${meshNodes[0]?.distanceToVictimKm || 0.4} km`,
      inRange: meshNodes[0]?.isConnected ?? true
    },
    {
      id: 'NODE-PERSON-C',
      title: 'PERSON C',
      sub: 'Emergency Volunteer Relay',
      status: 'AUTO-RELAY',
      dist: `${meshNodes[1]?.distanceToVictimKm || 0.6} km`,
      inRange: meshNodes[1]?.isConnected ?? true
    },
    {
      id: 'NODE-PERSON-D',
      title: 'PERSON D',
      sub: 'Responder Relay',
      status: 'AUTO-RELAY',
      dist: `${meshNodes[2]?.distanceToVictimKm || 0.8} km`,
      inRange: meshNodes[2]?.isConnected ?? true
    },
    {
      id: 'HQ',
      title: 'RESCUE CENTER (HQ)',
      sub: 'Command HQ Base',
      status: 'GATEWAY',
      dist: '2.1 km',
      inRange: true
    }
  ];

  // Truthful runtime peer list:
  // In native Android runtime, ONLY show real BLE peers.
  // In browser/demo mode, show the multi-hop demonstration chain.
  const activeHops = isNative ? realHops : (isBleMode ? realHops : demoHops);

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {onBack ? (
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#2563EB',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        ) : <div />}

        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)' }}>
          {t('radarHeader')}
        </div>
        <div style={{ width: 40 }} />
      </div>

      <HardwareStatusStrip />

      {/* Network Overview Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 16,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={20} color="#16A34A" />
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
              {t('connectedPeers')}: {Math.max(0, activeHops.length - 1)} Nodes
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: 'var(--color-safe-light, #F0FDF4)', padding: '3px 8px', borderRadius: 8 }}>
            {meshStatus}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-sub)' }}>
          {t('radarSubtitle')} (Bluetooth Low Energy Store-Carry-Forward)
        </p>

        {!isNative && !isBleMode && (
          <button
            onClick={handleToggleRange}
            style={{
              marginTop: 6,
              height: 38,
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-card)',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={13} />
            <span>Simulate Peer Range: {isNodeInRange ? 'Person C in range' : 'Person C out of range'}</span>
          </button>
        )}
      </div>

      {/* In Native Mode with 0 real peers: informative notice */}
      {isNative && realPeerIds.length === 0 && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 12,
          padding: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#D97706' }}>
            📡 NO PEERS CURRENTLY IN RANGE
          </div>
          <div style={{ fontSize: 11, color: '#92400E', marginTop: 3 }}>
            Scanning for nearby LIFELINE BLE devices. Packets will be stored and carried until a peer connects.
          </div>
        </div>
      )}

      {/* Interactive Clean Radar Visualizer */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 16,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        minHeight: 210,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        overflow: 'hidden'
      }}>
        {/* Radar concentric rings */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 170,
          height: 170,
          borderRadius: '50%',
          border: '1.5px dashed var(--border-card-highlight)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: '1.5px solid var(--border-card)',
          pointerEvents: 'none'
        }} />

        {/* Center Node (YOU) */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#DC2626',
          color: '#FFF',
          padding: '5px 10px',
          borderRadius: 14,
          fontSize: 11,
          fontWeight: 800,
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
          zIndex: 3
        }}>
          {isBleMode || isNative ? 'YOU' : 'YOU (SOURCE)'}
        </div>

        {/* Floating Relay Nodes */}
        {(isNative || isBleMode)
          ? realPeerIds.map((peerId, idx) => {
              const angle = (idx / realPeerIds.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 68;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const label = peerId.length > 10 ? `${peerId.slice(0, 8)}…` : peerId;
              return (
                <div
                  key={peerId}
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}px)`,
                    left: `calc(50% + ${x}px)`,
                    transform: 'translate(-50%, -50%)',
                    background: '#16A34A',
                    color: '#FFF',
                    padding: '3px 8px',
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 800,
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                    zIndex: 2,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {label}
                </div>
              );
            })
          : meshNodes.map((n, idx) => {
              const angle = (idx / meshNodes.length) * 2 * Math.PI - Math.PI / 2;
              const radius = n.isConnected ? 58 : 82;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <div
                  key={n.id}
                  style={{
                    position: 'absolute',
                    top: `calc(50% + ${y}px)`,
                    left: `calc(50% + ${x}px)`,
                    transform: 'translate(-50%, -50%)',
                    background: n.isConnected ? '#16A34A' : '#DC2626',
                    color: '#FFF',
                    padding: '3px 8px',
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 800,
                    boxShadow: n.isConnected ? '0 2px 6px rgba(22, 163, 74, 0.25)' : 'none',
                    zIndex: 2,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {n.type === 'RESCUE_GATEWAY' ? '🚨 RESCUE HQ' : n.name.split(' ')[0]} ({n.distanceToVictimKm}km)
                </div>
              );
            })}

        <div style={{ marginTop: 'auto', paddingTop: 160, fontSize: 11, color: '#64748B', textAlign: 'center' }}>
          {isBleMode || isNative ? 'Live BLE direct radio peers' : 'Direct connection range: ~1.0 km'}
        </div>
      </div>

      {/* Node Chain List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
          Active Mesh Topology Chain:
        </h3>

        {activeHops.map((hop, idx) => (
          <div
            key={idx}
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${hop.inRange ? 'var(--border-card)' : 'rgba(239, 68, 68, 0.4)'}`,
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: hop.status === 'SOURCE' ? '#EFF6FF' : hop.inRange ? '#F0FDF4' : '#FEF2F2',
                  color: hop.status === 'SOURCE' ? '#2563EB' : hop.inRange ? '#16A34A' : '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 13
                }}
              >
                {idx + 1}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{hop.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{hop.sub}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{hop.dist}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: hop.inRange ? '#16A34A' : '#DC2626' }}>
                {hop.inRange ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
            </div>
          </div>
        ))}
      </div>
      {import.meta.env.DEV && <BleDiagnosticsPanel />}
    </div>
  );
};

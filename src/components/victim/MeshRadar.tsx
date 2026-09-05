import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { Radio, Smartphone, RefreshCw, ArrowDown, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

export const MeshRadar: React.FC<Props> = ({ onBack }) => {
  const { meshNodes, location, meshStatus, user, simpleNetworkStatus, toggleSimulateNodeRange, victimActiveSos } = useApp();
  const [isNodeInRange, setIsNodeInRange] = useState(true);

  // Toggle simulate Person C entering/leaving range
  const handleToggleRange = () => {
    const res = toggleSimulateNodeRange();
    setIsNodeInRange(res);
  };

  // Multi-hop path definitions matching the user requirement:
  // PERSON A -> PERSON B -> PERSON C -> PERSON D -> RESCUE CENTER
  const hops = [
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
      id: 'NODE-RESCUE-CMD',
      title: 'RESCUE CENTER',
      sub: 'Tactical HQ Gateway',
      status: 'DESTINATION',
      dist: `${meshNodes[3]?.distanceToVictimKm || 2.4} km`,
      inRange: meshNodes[3]?.isConnected ?? true
    }
  ];

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header with back option if requested */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38BDF8',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginRight: 4
                }}
              >
                ← Back
              </button>
            )}
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#FFF' }}>📡 MESH NETWORK TOPOLOGY</h2>
          </div>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>Offline Multi-Hop Autonomous Relay (A → B → C → D → Rescue)</span>
        </div>
      </div>

      <HardwareStatusStrip />

      {/* Primary Simple Network Status Banner */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.45)',
        border: '1px solid var(--border-card-highlight)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', letterSpacing: 1 }}>
          📡 NETWORK STATUS
        </div>

        <div style={{ fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
          {simpleNetworkStatus === 'CONNECTED' && (
            <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="status-dot active"></span> 🟢 CONNECTED
            </span>
          )}
          {simpleNetworkStatus === 'SEARCHING' && (
            <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="status-dot searching"></span> 🟡 SEARCHING FOR NEARBY DEVICE...
            </span>
          )}
          {simpleNetworkStatus === 'WAITING_RELAY' && (
            <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="status-dot searching"></span> ⏳ WAITING FOR RELAY...
            </span>
          )}
          {simpleNetworkStatus === 'FORWARDED' && (
            <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="status-dot active"></span> 🟢 SOS FORWARDED
            </span>
          )}
          {simpleNetworkStatus === 'DELIVERED' && (
            <span style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={16} color="#38BDF8" /> ✓ RESCUE CENTER REACHED
            </span>
          )}
        </div>

        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          {simpleNetworkStatus === 'WAITING_RELAY'
            ? 'Store-Carry-Forward active: Packet is securely held on relay device until the next node enters 1.0 km range.'
            : 'Multi-hop packets forward automatically through in-range nodes without any manual selection.'}
        </div>
      </div>

      {/* Multi-Hop Relay Chain Diagram (A -> B -> C -> D -> Rescue) */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 14,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
            Multi-Hop Transmission Path:
          </div>
          <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>
            Automated Routing
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {hops.map((hop, idx) => (
            <React.Fragment key={hop.id}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: hop.inRange ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${hop.inRange ? 'var(--border-card)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 10,
                padding: '8px 10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: idx === 0 ? '#EF4444' : idx === hops.length - 1 ? '#0284C7' : '#334155',
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800
                  }}>
                    {idx === 0 ? 'A' : idx === 1 ? 'B' : idx === 2 ? 'C' : idx === 3 ? 'D' : 'HQ'}
                  </div>

                  <div>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#FFF' }}>
                      {hop.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>
                      {hop.sub} • {hop.dist}
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: hop.inRange ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: hop.inRange ? '#10B981' : '#EF4444',
                  border: `1px solid ${hop.inRange ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {hop.inRange ? '🟢 IN RANGE' : '🔴 OUT OF RANGE'}
                </span>
              </div>

              {idx < hops.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0' }}>
                  <div style={{
                    width: 2,
                    height: 12,
                    background: hop.inRange ? '#10B981' : '#64748B'
                  }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Interactive Radar Visualizer */}
      <div style={{
        background: '#090D16',
        border: '1px solid var(--border-card)',
        borderRadius: 16,
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        minHeight: 200
      }}>
        {/* Radar Rings */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 160,
          height: 160,
          borderRadius: '50%',
          border: '1px dashed rgba(56, 189, 248, 0.2)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 90,
          height: 90,
          borderRadius: '50%',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          pointerEvents: 'none'
        }} />

        {/* Center: Person A */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#EF4444',
          color: '#FFF',
          padding: '4px 8px',
          borderRadius: 16,
          fontSize: 10,
          fontWeight: 800,
          boxShadow: '0 0 14px rgba(239,68,68,0.8)',
          zIndex: 3
        }}>
          PERSON A (YOU)
        </div>

        {/* Floating Relay Nodes */}
        {meshNodes.map((n, idx) => {
          const angle = (idx / meshNodes.length) * 2 * Math.PI - Math.PI / 2;
          const radius = n.isConnected ? 58 : 86;
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
                background: n.isConnected ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.85)',
                color: '#FFF',
                padding: '3px 7px',
                borderRadius: 10,
                fontSize: 9,
                fontWeight: 800,
                boxShadow: n.isConnected ? '0 0 10px rgba(16, 185, 129, 0.6)' : 'none',
                zIndex: 2,
                whiteSpace: 'nowrap'
              }}
            >
              {n.type === 'RESCUE_GATEWAY' ? '🚨 RESCUE HQ' : n.name.split(' ')[0]} ({n.distanceToVictimKm}km)
            </div>
          );
        })}

        <div style={{ marginTop: 'auto', paddingTop: 130, fontSize: 10, color: '#64748B', textAlign: 'center' }}>
          Configured direct connection range: 1.0 km
        </div>
      </div>

      {/* Interactive Range Simulator Trigger */}
      <div style={{
        background: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 12,
        padding: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#FFF' }}>
            Simulate Movement & Store-Carry-Forward
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>
            Move Person C out of range to test "WAITING FOR RELAY...", then bring back into range to auto-forward.
          </div>
        </div>

        <button
          onClick={handleToggleRange}
          style={{
            background: 'linear-gradient(135deg, #0284C7, #0369A1)',
            border: 'none',
            color: '#FFF',
            fontSize: 11,
            fontWeight: 800,
            padding: '8px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0
          }}
        >
          <RefreshCw size={12} />
          Toggle Range
        </button>
      </div>
    </div>
  );
};

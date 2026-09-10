import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { Radio, Smartphone, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface Props {
  onBack?: () => void;
}

export const MeshRadar: React.FC<Props> = ({ onBack }) => {
  const { meshNodes, meshStatus, user, toggleSimulateNodeRange, realPeerIds, t } = useApp();
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

  const activeHops = isBleMode ? realHops : demoHops;

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

        <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A' }}>
          {t('radarHeader')}
        </div>
        <div style={{ width: 40 }} />
      </div>

      <HardwareStatusStrip />

      {/* Network Overview Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={20} color="#16A34A" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
              {t('connectedPeers')}: {activeHops.length - 1} Nodes
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '3px 8px', borderRadius: 8 }}>
            {meshStatus}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#64748B' }}>
          {t('radarSubtitle')} (Bluetooth Low Energy Store-Carry-Forward)
        </p>

        {!isBleMode && (
          <button
            onClick={handleToggleRange}
            style={{
              marginTop: 6,
              height: 38,
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              color: '#0F172A',
              cursor: 'pointer'
            }}
          >
            Simulate Peer Range: {isNodeInRange ? 'Person C in range' : 'Person C out of range'}
          </button>
        )}
      </div>

      {/* Node Chain List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
          Active Mesh Topology Chain:
        </h3>

        {activeHops.map((hop, idx) => (
          <div
            key={idx}
            style={{
              background: '#FFFFFF',
              border: `1px solid ${hop.inRange ? '#E2E8F0' : '#FECACA'}`,
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
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: hop.status === 'SOURCE' ? '#EFF6FF' : hop.inRange ? '#F0FDF4' : '#FEF2F2',
                  color: hop.status === 'SOURCE' ? '#2563EB' : hop.inRange ? '#16A34A' : '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800
                }}
              >
                {idx + 1}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{hop.title}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{hop.sub}</div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{hop.dist}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: hop.inRange ? '#16A34A' : '#DC2626' }}>
                {hop.inRange ? 'CONNECTED' : 'DISCONNECTED'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

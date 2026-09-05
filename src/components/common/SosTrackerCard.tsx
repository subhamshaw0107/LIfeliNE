import React from 'react';
import { SosPacket, DeliveryStatus } from '../../types';
import { ShieldCheck, CheckCircle2, Clock, Radio, Check } from 'lucide-react';

interface Props {
  packet: SosPacket;
  onInspect?: () => void;
}

const STEPS: { status: DeliveryStatus; label: string; sub: string }[] = [
  { status: 'CREATED', label: 'SOS Generated', sub: 'Coordinates & Device ID attached' },
  { status: 'ENCRYPTED', label: 'Authenticated Encryption', sub: '256-bit AES-GCM locked' },
  { status: 'STORED', label: 'Stored Locally (DTN)', sub: 'Safely buffered in flash memory' },
  { status: 'RELAYING', label: 'Mesh Relay Active', sub: 'Store-Carry-Forward propagation' },
  { status: 'DELIVERED', label: 'Rescue Gateway Reached', sub: 'Command HQ received packet' },
  { status: 'ACKNOWLEDGED', label: 'Rescue Team Acknowledged', sub: 'Drone / team dispatching' },
  { status: 'RESPONDING', label: 'Rescue in Progress', sub: 'Emergency crew en route' },
  { status: 'RESCUED', label: 'Rescued & Safe', sub: 'Evacuated to designated shelter' }
];

export const SosTrackerCard: React.FC<Props> = ({ packet, onInspect }) => {
  const getStepState = (targetStatus: DeliveryStatus): 'done' | 'current' | 'pending' => {
    const statusOrder: DeliveryStatus[] = [
      'CREATED',
      'ENCRYPTED',
      'STORED',
      'RELAYING',
      'DELIVERED',
      'ACKNOWLEDGED',
      'RESPONDING',
      'RESCUED'
    ];

    const targetIdx = statusOrder.indexOf(targetStatus);
    const currentIdx = statusOrder.indexOf(packet.status);

    if (currentIdx > targetIdx) return 'done';
    if (currentIdx === targetIdx) return 'current';
    return 'pending';
  };

  return (
    <div className="sos-tracker-card">
      <div className="sos-tracker-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="tracker-id-badge">{packet.id}</span>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38BDF8',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            Sender: {packet.senderId || 'PERSON-A'}
          </span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{packet.timeFormatted}</span>
        </div>
        <span className={`tracker-status-tag ${packet.status.toLowerCase()}`}>
          {packet.status.replace('_', ' ')}
        </span>
      </div>

      {/* Emergency Message & Dynamic Priority Summary */}
      <div style={{
        background: packet.priority === 'CRITICAL'
          ? 'rgba(239, 68, 68, 0.12)'
          : packet.priority === 'HIGH'
          ? 'rgba(245, 158, 11, 0.12)'
          : 'rgba(16, 185, 129, 0.12)',
        border: `1px solid ${
          packet.priority === 'CRITICAL'
            ? 'rgba(239, 68, 68, 0.35)'
            : packet.priority === 'HIGH'
            ? 'rgba(245, 158, 11, 0.35)'
            : 'rgba(16, 185, 129, 0.35)'
        }`,
        padding: '8px 10px',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12,
        transition: 'all 0.3s ease'
      }}>
        <div>
          <span style={{ color: '#94A3B8', fontSize: 11 }}>Message: </span>
          <span style={{ fontWeight: 600, color: '#FFF' }}>"{packet.message || 'I need help.'}"</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: 6,
            background: packet.priority === 'CRITICAL'
              ? '#EF4444'
              : packet.priority === 'HIGH'
              ? '#F59E0B'
              : '#10B981',
            color: '#FFF',
            letterSpacing: '0.05em'
          }}>
            {packet.priority === 'CRITICAL' && '🔴 '}
            {packet.priority === 'HIGH' && '🟡 '}
            {packet.priority === 'LOW' && '🟢 '}
            {packet.priority}
          </div>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#38BDF8',
            background: 'rgba(56, 189, 248, 0.12)',
            padding: '2px 5px',
            borderRadius: 4,
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            ⚡ DYNAMIC
          </span>
        </div>
      </div>

      {/* Security Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.05)',
        padding: '6px 10px',
        borderRadius: 8,
        fontSize: 11
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981' }}>
          <ShieldCheck size={14} />
          <span>Security: Authenticated Encryption ✓</span>
        </div>
        <span style={{ color: '#94A3B8', fontFamily: 'monospace' }}>AES-GCM</span>
      </div>

      {/* Route visualization summary */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 11,
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}>
        <div style={{ color: '#94A3B8', fontWeight: 600 }}>Mesh Relay Path:</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', color: '#FFF' }}>
          {packet.route.map((hop, idx) => (
            <React.Fragment key={idx}>
              <span style={{ color: idx === packet.route.length - 1 ? '#38BDF8' : '#F1F5F9' }}>
                {hop}
              </span>
              {idx < packet.route.length - 1 && <span style={{ color: '#64748B' }}>→</span>}
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span>🛡️ Relays forward packet without taking ownership. Duplicate suppression & loop-protection active.</span>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="timeline-step-list">
        {STEPS.map((step, idx) => {
          const state = getStepState(step.status);
          return (
            <div key={idx} className="timeline-step-item">
              <div className={`step-icon-circle ${state}`}>
                {state === 'done' ? <Check size={11} strokeWidth={3} /> : state === 'current' ? <Radio size={11} /> : idx + 1}
              </div>
              <div className="step-text-content">
                <div className="step-text-title" style={{
                  color: state === 'current' ? '#F59E0B' : state === 'done' ? '#10B981' : '#64748B'
                }}>
                  {step.label} {state === 'current' && '⏳'}
                </div>
                <div className="step-text-sub">{step.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {onInspect && (
        <button
          onClick={onInspect}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-card)',
            color: '#FFF',
            padding: '8px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 4
          }}
        >
          Inspect Technical Packet & Cryptography
        </button>
      )}
    </div>
  );
};

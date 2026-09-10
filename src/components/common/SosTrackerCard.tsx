import React from 'react';
import { useApp } from '../../context/AppContext';
import { SosPacket } from '../../types';
import { ShieldCheck, Check, Radio } from 'lucide-react';

interface Props {
  packet?: SosPacket;
  onInspect?: () => void;
}

export const SosTrackerCard: React.FC<Props> = ({ packet: propPacket, onInspect }) => {
  const { victimActiveSos, t } = useApp();
  const packet = propPacket || victimActiveSos;

  if (!packet) return null;

  const isDelivered = packet.status === 'DELIVERED' || packet.status === 'ACKNOWLEDGED' || packet.status === 'RESPONDING' || packet.status === 'RESCUED';
  const isClaimed = packet.status === 'ACKNOWLEDGED' || packet.status === 'RESPONDING' || packet.status === 'RESCUED';

  return (
    <div className="sos-tracker-card">
      <div className="sos-tracker-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
            {t('trackerTitle')}
          </span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: 6 }}>
            {packet.id}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
          {packet.timeFormatted}
        </span>
      </div>

      {/* Progress Timeline */}
      <div className="tracker-steps-list">
        {/* Step 1: Sent */}
        <div className="tracker-step-item completed">
          <div className="step-indicator">
            <Check size={14} />
          </div>
          <div className="step-content">
            <div className="step-title">{t('step1')}</div>
            <div className="step-desc">{t('step1Sub')}</div>
          </div>
        </div>

        {/* Step 2: Mesh Relayed */}
        <div className={`tracker-step-item ${isDelivered ? 'completed' : ''}`}>
          <div className="step-indicator">
            {isDelivered ? <Check size={14} /> : <Radio size={14} color="#D97706" />}
          </div>
          <div className="step-content">
            <div className="step-title">{t('step2')}</div>
            <div className="step-desc">{t('step2Sub')} ({packet.hopCount} Hops)</div>
          </div>
        </div>

        {/* Step 3: Rescuer Acknowledged */}
        <div className={`tracker-step-item ${isClaimed ? 'completed' : ''}`}>
          <div className="step-indicator">
            {isClaimed ? <Check size={14} /> : '3'}
          </div>
          <div className="step-content">
            <div className="step-title">{t('step3')}</div>
            <div className="step-desc">{t('step3Sub')}</div>
          </div>
        </div>
      </div>

      {/* Security info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16A34A', background: '#F0FDF4', padding: '8px 10px', borderRadius: 10 }}>
        <ShieldCheck size={16} />
        <span style={{ fontWeight: 600 }}>Authenticated Encrypted Packet (AES-GCM)</span>
      </div>

      {onInspect && (
        <button
          onClick={onInspect}
          style={{
            height: 38,
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            color: '#0F172A',
            cursor: 'pointer'
          }}
        >
          Inspect Technical Packet & Cryptography
        </button>
      )}
    </div>
  );
};

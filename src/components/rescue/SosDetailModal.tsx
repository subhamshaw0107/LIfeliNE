import React, { useState } from 'react';
import { SosPacket } from '../../types';
import { cryptoService } from '../../services/cryptoService';
import {
  ShieldCheck,
  MapPin,
  Clock,
  Radio,
  Battery,
  AlertTriangle,
  CheckCircle2,
  X,
  Lock,
  Eye,
  KeyRound
} from 'lucide-react';

interface Props {
  packet: SosPacket;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onRespond: (id: string) => void;
  onMarkRescued: (id: string) => void;
}

export const SosDetailModal: React.FC<Props> = ({
  packet,
  onClose,
  onAcknowledge,
  onRespond,
  onMarkRescued
}) => {
  const [decryptedData, setDecryptedData] = useState<Record<string, unknown> | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleTestDecryption = async () => {
    setIsDecrypting(true);
    try {
      const res = await cryptoService.decryptSosPayload(packet.encryptedPayload, packet.iv);
      setDecryptedData(res);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>TECHNICAL TELEMETRY</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0F172A' }}>SOS PACKET INSPECTOR</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              color: '#0F172A',
              width: 34,
              height: 34,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status and Priority Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                background: packet.priority === 'CRITICAL' ? '#FEF2F2' : packet.priority === 'HIGH' ? '#FFFBEB' : '#F0FDF4',
                color: packet.priority === 'CRITICAL' ? '#DC2626' : packet.priority === 'HIGH' ? '#D97706' : '#16A34A',
                fontWeight: 800,
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 8
              }}
            >
              {packet.priority} PRIORITY
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#2563EB', fontSize: 14 }}>
              {packet.id}
            </span>
          </div>

          <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
            {packet.status}
          </span>
        </div>

        {/* Victim Info Card */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Sender ID:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
              {packet.senderId || packet.userId}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Device ID:</span>
            <span style={{ fontFamily: 'monospace', color: '#0F172A', fontWeight: 700 }}>{packet.deviceId}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>GPS Coordinates:</span>
            <span style={{ fontFamily: 'monospace', color: '#0F172A' }}>
              {packet.latitude.toFixed(4)}, {packet.longitude.toFixed(4)} (±{packet.gpsAccuracy}m)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Distance to Base:</span>
            <span style={{ fontWeight: 700, color: '#2563EB' }}>{packet.distanceFromRescueKm} km</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748B' }}>Battery:</span>
            <span style={{ color: '#0F172A', fontWeight: 700 }}>{packet.batteryLevel}%</span>
          </div>
        </div>

        {/* Message Content */}
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            color: '#991B1B'
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', marginBottom: 2 }}>
            Emergency Distress Message:
          </div>
          "{packet.message}"
        </div>

        {/* Cryptography Info */}
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontWeight: 800 }}>
              <ShieldCheck size={16} />
              <span>AUTHENTICATED ENCRYPTION</span>
            </div>
            <span style={{ fontFamily: 'monospace', color: '#16A34A', fontWeight: 700 }}>AES-GCM-256</span>
          </div>

          <button
            onClick={handleTestDecryption}
            style={{
              height: 38,
              background: '#16A34A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: 4
            }}
          >
            {isDecrypting ? 'Decrypting...' : 'Test AES-GCM Decryption'}
          </button>

          {decryptedData && (
            <pre style={{ background: '#FFFFFF', padding: 8, borderRadius: 6, fontSize: 11, color: '#0F172A', overflowX: 'auto' }}>
              {JSON.stringify(decryptedData, null, 2)}
            </pre>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {packet.status !== 'RESPONDING' && packet.status !== 'RESCUED' && (
            <button
              onClick={() => {
                onRespond(packet.id);
                onClose();
              }}
              style={{
                flex: 1,
                height: 46,
                background: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Respond Now
            </button>
          )}

          {packet.status !== 'RESCUED' && (
            <button
              onClick={() => {
                onMarkRescued(packet.id);
                onClose();
              }}
              style={{
                flex: 1,
                height: 46,
                background: '#16A34A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Mark Rescued
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

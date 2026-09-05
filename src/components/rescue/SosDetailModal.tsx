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
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>TELEMETRY INSPECTOR</div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#FFF' }}>SOS DETAILS</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#FFF',
              width: 32,
              height: 32,
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
            <span style={{
              background: packet.priority === 'CRITICAL' ? '#EF4444' : packet.priority === 'HIGH' ? '#F59E0B' : '#10B981',
              color: '#FFF',
              fontWeight: 800,
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 8
            }}>
              {packet.priority === 'CRITICAL' ? '🔴 CRITICAL' : packet.priority === 'HIGH' ? '🟡 HIGH' : '🟢 LOW'}
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8', fontSize: 14 }}>
              {packet.id}
            </span>
          </div>

          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.08)',
            color: '#FFF'
          }}>
            {packet.status}
          </span>
        </div>

        {/* Victim Information Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-card)',
          borderRadius: 12,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Sender ID (Original Creator):</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
              {packet.senderId || packet.userId || 'PERSON-A'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Device Identifier:</span>
            <span style={{ fontFamily: 'monospace', color: '#FFF', fontWeight: 700 }}>{packet.deviceId}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Exact GPS Coordinates:</span>
            <span style={{ fontFamily: 'monospace', color: '#FFF' }}>
              {packet.latitude.toFixed(4)}, {packet.longitude.toFixed(4)} (±{packet.gpsAccuracy}m)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Distance from Flood Zone:</span>
            <span style={{ fontWeight: 800, color: '#EF4444' }}>{packet.distanceFromDisasterKm} km</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Distance to Rescue HQ:</span>
            <span style={{ fontWeight: 700, color: '#38BDF8' }}>{packet.distanceFromRescueKm} km</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Battery Level:</span>
            <span style={{ color: '#FFF' }}>{packet.batteryLevel}%</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8' }}>Timestamp:</span>
            <span style={{ color: '#FFF' }}>{packet.timeFormatted}</span>
          </div>
        </div>

        {/* Message Content */}
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12,
          padding: '10px 12px',
          fontSize: 13,
          color: '#FFF'
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', marginBottom: 2 }}>
            Emergency Message:
          </div>
          "{packet.message}"
        </div>

        {/* Mesh Route & Delay Tolerant Routing */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-card)',
          borderRadius: 12,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 11
        }}>
          <div style={{ fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
            Mesh Multi-Hop Route Chain:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {packet.route.map((hop, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: i === packet.route.length - 1 ? '#0284C7' : '#334155',
                  color: '#FFF',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  {i + 1}
                </span>
                <span style={{ color: i === packet.route.length - 1 ? '#38BDF8' : '#FFF', fontWeight: 600 }}>
                  {hop}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-card)', paddingTop: 6 }}>
            <span>Hop Count: <strong style={{ color: '#FFF' }}>{packet.hopCount}</strong></span>
            <span>Packet TTL: <strong style={{ color: '#FFF' }}>{packet.ttl}</strong></span>
            <span>Delivery: <strong style={{ color: '#10B981' }}>{packet.status}</strong></span>
          </div>
          <div style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: 4 }}>
            🛡️ Intermediate relays act exclusively as forwarders. Original Sender ({packet.senderId || 'PERSON-A'}) and SOS ID ({packet.id}) remain immutable.
          </div>
        </div>

        {/* Cryptography & AES-GCM Authenticated Encryption */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 12,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 11
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 800 }}>
              <ShieldCheck size={16} />
              <span>SECURITY: AUTHENTICATED ENCRYPTION ✓</span>
            </div>
            <span style={{ fontFamily: 'monospace', color: '#94A3B8' }}>AES-GCM-256</span>
          </div>

          <div style={{ color: '#94A3B8' }}>
            Unique 96-bit Nonce/IV: <span style={{ fontFamily: 'monospace', color: '#FFF' }}>{packet.iv}</span>
          </div>

          <div style={{ color: '#94A3B8', wordBreak: 'break-all' }}>
            Ciphertext: <span style={{ fontFamily: 'monospace', color: '#64748B' }}>{packet.encryptedPayload.slice(0, 32)}...</span>
          </div>

          <button
            onClick={handleTestDecryption}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10B981',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              marginTop: 4
            }}
          >
            <KeyRound size={12} />
            {isDecrypting ? 'Verifying Integrity...' : 'Verify Cryptographic Signature & Decrypt'}
          </button>

          {decryptedData && (
            <div style={{
              background: '#04151D',
              border: '1px solid #0891B2',
              borderRadius: 8,
              padding: '8px',
              color: '#67E8F9',
              fontFamily: 'monospace',
              fontSize: 10
            }}>
              <div>✓ Authentication Tag Matched (0 tampering)</div>
              <div>Payload: {JSON.stringify(decryptedData, null, 2)}</div>
            </div>
          )}
        </div>

        {/* Rescue Actions Row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {packet.status !== 'ACKNOWLEDGED' && packet.status !== 'RESPONDING' && packet.status !== 'RESCUED' && (
            <button
              onClick={() => onAcknowledge(packet.id)}
              className="triage-btn ack"
              style={{ padding: '10px' }}
            >
              [ACKNOWLEDGE SOS]
            </button>
          )}

          {packet.status !== 'RESPONDING' && packet.status !== 'RESCUED' && (
            <button
              onClick={() => onRespond(packet.id)}
              className="triage-btn respond"
              style={{ padding: '10px' }}
            >
              [RESPONDING]
            </button>
          )}

          {packet.status !== 'RESCUED' && (
            <button
              onClick={() => onMarkRescued(packet.id)}
              className="triage-btn rescued"
              style={{ padding: '10px' }}
            >
              [MARK RESCUED]
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { createPortal } from 'react-dom';
import { SosPacket } from '../../types';
import { MapPin, Radio, ShieldAlert, X } from 'lucide-react';

interface Props {
  packet: SosPacket;
  onClose: () => void;
  onViewOnMap?: () => void;
  onViewMesh?: () => void;
}

export const RedZoneEmergencyModal: React.FC<Props> = ({
  packet,
  onClose,
  onViewOnMap,
  onViewMesh
}) => {
  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#FFFFFF',
          border: '2px solid #DC2626',
          borderRadius: '20px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Emergency Beacon Bar */}
        <div
          style={{
            background: '#DC2626',
            color: '#FFFFFF',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 15 }}>
            <ShieldAlert size={20} />
            <span>RED ZONE EMERGENCY ALERT</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#DC2626', background: '#FEF2F2', padding: '4px 10px', borderRadius: 8 }}>
              HIGH PRIORITY DISASTER
            </span>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{packet.timeFormatted}</span>
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
            Victim: {packet.senderId || packet.userId}
          </div>

          <div style={{ fontSize: 14, color: '#334155', background: '#F8FAFC', padding: '12px', borderRadius: 12, border: '1px solid #E2E8F0', fontStyle: 'italic' }}>
            "{packet.message || 'Emergency assistance needed in red zone.'}"
          </div>

          <div style={{ fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>Location: <strong>{packet.disasterZoneName || 'Flood Zone A'}</strong></div>
            <div>Distance from Base: <strong>{packet.distanceFromRescueKm} km</strong></div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {onViewOnMap && (
              <button
                onClick={() => {
                  onViewOnMap();
                  onClose();
                }}
                style={{
                  flex: 1,
                  height: 46,
                  background: '#2563EB',
                  border: 'none',
                  borderRadius: 12,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <MapPin size={16} />
                <span>View on Map</span>
              </button>
            )}

            {onViewMesh && (
              <button
                onClick={() => {
                  onViewMesh();
                  onClose();
                }}
                style={{
                  flex: 1,
                  height: 46,
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: 12,
                  color: '#0F172A',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Radio size={16} />
                <span>Mesh Hops</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

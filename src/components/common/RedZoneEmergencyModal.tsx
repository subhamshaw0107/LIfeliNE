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
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(180deg, #1C0B0B 0%, #111827 100%)',
          border: '2px solid #EF4444',
          borderRadius: '16px',
          boxShadow: '0 0 35px rgba(239, 68, 68, 0.5), inset 0 0 15px rgba(239, 68, 68, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Top Emergency Beacon Bar */}
        <div
          style={{
            background: '#EF4444',
            color: '#FFFFFF',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, animation: 'pulse 1s infinite' }}>🚨</span>
            <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.05em' }}>
              RED DANGER ZONE SOS ALERT
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0,0,0,0.25)',
              border: 'none',
              borderRadius: '50%',
              width: 26,
              height: 26,
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Main Warning Box */}
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 12,
              padding: '12px',
              display: 'flex',
              gap: 10
            }}
          >
            <ShieldAlert size={26} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 13 }}>
                VICTIM IN CRITICAL RED DISASTER ZONE
              </div>
              <div style={{ color: '#FCA5A5', fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                An emergency SOS has been initiated from inside an active <strong>RED Disaster Zone</strong> ({packet.disasterZoneName}). Priority automatically elevated to <strong>CRITICAL</strong>.
              </div>
            </div>
          </div>

          {/* Telemetry Details Grid */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8' }}>SOS Identifier:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8', fontSize: 13 }}>
                {packet.id}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8' }}>Sender ID:</span>
              <span style={{ fontWeight: 800, color: '#F8FAFC', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: 4 }}>
                {packet.senderId || 'PERSON-A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8' }}>Calculated Priority:</span>
              <span style={{ background: '#EF4444', color: '#FFF', fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
                🔴 {packet.priority}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8' }}>Hazard Proximity:</span>
              <span style={{ color: '#EF4444', fontWeight: 700 }}>
                {packet.distanceFromDisasterKm} km from Flood Core
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8' }}>GPS Coordinates:</span>
              <span style={{ fontFamily: 'monospace', color: '#CBD5E1' }}>
                {packet.latitude.toFixed(4)}, {packet.longitude.toFixed(4)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94A3B8' }}>Message:</span>
              <span style={{ color: '#FFF', fontStyle: 'italic', fontWeight: 600 }}>
                "{packet.message}"
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {onViewOnMap && (
              <button
                onClick={() => {
                  onClose();
                  onViewOnMap();
                }}
                style={{
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                }}
              >
                <MapPin size={16} />
                <span>VIEW LIVE GOOGLE MAP (RED & GREEN ZONES)</span>
              </button>
            )}

            {onViewMesh && (
              <button
                onClick={() => {
                  onClose();
                  onViewMesh();
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38BDF8',
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <Radio size={15} />
                <span>TRACK STORE-CARRY-FORWARD MESH HOPS</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94A3B8',
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Dismiss Alert & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

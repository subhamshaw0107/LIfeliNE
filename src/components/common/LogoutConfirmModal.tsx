import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LogoutConfirmModal: React.FC<Props> = ({ isOpen, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(4, 7, 17, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '340px',
          background: 'linear-gradient(180deg, #111827 0%, #0B101D 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.45)',
          borderRadius: '20px',
          padding: '22px 20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          color: '#FFF',
          fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logout Warning Emblem */}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)'
          }}
        >
          <LogOut size={26} />
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '0.5px', color: '#FFF' }}>
          Logout Confirmation
        </h3>

        <p style={{ fontSize: '13px', color: '#CBD5E1', margin: '0 0 8px 0', fontWeight: 600 }}>
          Are you sure you want to logout?
        </p>

        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 20px 0', lineHeight: 1.45 }}>
          You will return to the Login screen. Your device data and offline SOS logs will remain safe.
        </p>

        {/* Modal Buttons: [Cancel] [Logout] */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '11px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#CBD5E1',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '11px 14px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #EF4444, #DC2626)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

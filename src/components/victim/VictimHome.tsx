import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { SosTrackerCard } from '../common/SosTrackerCard';
import {
  AlertTriangle,
  Radio,
  MapPin,
  MessageSquare,
  Map,
  ShieldCheck,
  CheckCircle2,
  HeartPulse,
  Users,
  Flame
} from 'lucide-react';

interface Props {
  onNavigateToMap: () => void;
  onNavigateToMessages: () => void;
  onNavigateToMesh: () => void;
  onInspectPacket?: (sosId: string) => void;
}

export const VictimHome: React.FC<Props> = ({
  onNavigateToMap,
  onNavigateToMessages,
  onNavigateToMesh
}) => {
  const {
    victimActiveSos,
    sendSos,
    markSafe,
    sendQuickMessage,
    t
  } = useApp();

  const [isSending, setIsSending] = useState(false);

  const handleSosClick = async (customText?: string) => {
    if (isSending) return;
    setIsSending(true);
    try {
      if (customText) {
        await sendQuickMessage(customText);
      } else {
        await sendSos();
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSafeClick = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await markSafe();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="victim-home-container">
      {/* Hardware Status Strip */}
      <HardwareStatusStrip />

      {/* Main Emergency Panic Action Section */}
      <div className="sos-button-wrapper">
        {!victimActiveSos ? (
          /* Calm, Solid Red SOS Emergency Panic Button (NO flashy/continuous pulse animations) */
          <button
            className="giant-sos-btn"
            onClick={() => handleSosClick()}
            disabled={isSending}
            aria-label={t('sosButtonLabel')}
          >
            <AlertTriangle size={48} color="#FFFFFF" />
            <span className="sos-btn-title">
              {isSending ? 'SENDING...' : t('sosButtonLabel')}
            </span>
            <span className="sos-btn-subtext">
              {t('sosButtonSubtext')}
            </span>
          </button>
        ) : (
          /* Active SOS Status State */
          <div
            style={{
              width: '100%',
              background: '#FEF2F2',
              border: '2px solid #FECACA',
              borderRadius: 20,
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 900, fontSize: 16 }}>
              <AlertTriangle size={24} />
              <span>{t('sosActiveStatus')}</span>
            </div>
            <p style={{ fontSize: 13, color: '#991B1B', fontWeight: 500 }}>
              {t('sosActiveSubtext')}
            </p>
            <button
              onClick={handleSafeClick}
              disabled={isSending}
              style={{
                height: 48,
                width: '100%',
                background: '#16A34A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 6
              }}
            >
              <CheckCircle2 size={18} />
              <span>{t('markSafeBtn')}</span>
            </button>
          </div>
        )}
      </div>

      {/* SOS Signal Progress Tracker */}
      <SosTrackerCard />

      {/* 4 Quick Category Emergency Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
          {t('quickCategoriesTitle')}
        </h3>

        <div className="quick-category-grid">
          <button
            className="category-card-btn"
            onClick={() => handleSosClick(t('catMedical'))}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <HeartPulse size={22} />
            </div>
            <span className="category-card-title">{t('catMedical')}</span>
          </button>

          <button
            className="category-card-btn"
            onClick={() => handleSosClick(t('catTrapped'))}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#FFFBEB', color: '#D97706' }}>
              <Users size={22} />
            </div>
            <span className="category-card-title">{t('catTrapped')}</span>
          </button>

          <button
            className="category-card-btn"
            onClick={() => handleSosClick(t('catHazard'))}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <Flame size={22} />
            </div>
            <span className="category-card-title">{t('catHazard')}</span>
          </button>

          <button
            className="category-card-btn"
            onClick={handleSafeClick}
            disabled={isSending}
          >
            <div className="category-icon-box" style={{ background: '#F0FDF4', color: '#16A34A' }}>
              <CheckCircle2 size={22} />
            </div>
            <span className="category-card-title">{t('catSafe')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { Send, CheckCircle2, AlertTriangle, HeartPulse, Truck, Users, Droplets, Ban, ArrowLeft } from 'lucide-react';

export const EmergencyChat: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { sendQuickMessage, sosList, user, location, t } = useApp();
  const [customText, setCustomText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const PREDEFINED_MESSAGES = [
    { text: t('msgHelp'), icon: AlertTriangle, color: '#DC2626' },
    { text: t('msgTrapped'), icon: Users, color: '#DC2626' },
    { text: t('msgMedical'), icon: HeartPulse, color: '#DC2626' },
    { text: t('msgEvac'), icon: Truck, color: '#D97706' },
    { text: t('msgInjured'), icon: HeartPulse, color: '#DC2626' },
    { text: t('msgWater'), icon: Droplets, color: '#D97706' },
    { text: t('msgBlocked'), icon: Ban, color: '#D97706' },
    { text: t('msgSafe'), icon: CheckCircle2, color: '#16A34A' }
  ];

  const handleSend = async (msg: string) => {
    if (!msg.trim() || isSending) return;
    setIsSending(true);
    try {
      await sendQuickMessage(msg);
      setCustomText('');
    } finally {
      setIsSending(false);
    }
  };

  const myMessages = sosList.filter((p) => p.userId === user?.userId);

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-main)' }}>
          {t('chatHeader')}
        </div>
        <div style={{ width: 40 }} />
      </div>

      <HardwareStatusStrip />

      {/* Notice Banner */}
      <div
        style={{
          background: 'var(--color-primary-light, #EFF6FF)',
          border: '1px solid var(--border-card-highlight)',
          borderRadius: 12,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--color-primary)',
          lineHeight: 1.4
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 2 }}>📡 MESH BROADCAST</div>
        <div>{t('chatNotice')} ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})</div>
      </div>

      {/* Predefined 1-Tap Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
          {t('presetHeader')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PREDEFINED_MESSAGES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(item.text)}
                disabled={isSending}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '12px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                <Icon size={18} color={item.color} style={{ flexShrink: 0 }} />
                <span>{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Text Input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={t('customMsgPlaceholder')}
          style={{
            flex: 1,
            height: 48,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 12,
            padding: '0 14px',
            color: 'var(--text-main)',
            fontSize: 14,
            outline: 'none'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(customText);
          }}
        />
        <button
          onClick={() => handleSend(customText)}
          disabled={isSending}
          style={{
            width: 48,
            height: 48,
            background: '#2563EB',
            border: 'none',
            borderRadius: 12,
            color: '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Sent History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
          {t('sentHistoryHeader')} ({myMessages.length}):
        </div>

        {myMessages.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-sub)', textAlign: 'center', padding: '16px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-card)' }}>
            No emergency messages sent yet.
          </div>
        ) : (
          myMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontWeight: 700 }}>
                  {msg.id}
                </span>
                <span style={{ color: 'var(--text-sub)' }}>{msg.timeFormatted}</span>
              </div>
              <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 14 }}>
                "{msg.message}"
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

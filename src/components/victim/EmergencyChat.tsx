import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardwareStatusStrip } from '../common/HardwareStatusStrip';
import { MessageSquare, Send, CheckCircle2, AlertOctagon, HeartPulse, Truck, Users, Droplets, Ban } from 'lucide-react';

const PREDEFINED_MESSAGES = [
  { text: 'I need help.', icon: AlertOctagon, color: '#EF4444' },
  { text: 'We are trapped.', icon: Users, color: '#EF4444' },
  { text: 'Medical help needed.', icon: HeartPulse, color: '#EF4444' },
  { text: 'We need evacuation.', icon: Truck, color: '#F59E0B' },
  { text: 'People are injured.', icon: HeartPulse, color: '#EF4444' },
  { text: 'We need food and water.', icon: Droplets, color: '#F59E0B' },
  { text: 'Road is blocked.', icon: Ban, color: '#F59E0B' },
  { text: 'I am safe.', icon: CheckCircle2, color: '#10B981' }
];

export const EmergencyChat: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { sendQuickMessage, sosList, user, location } = useApp();
  const [customText, setCustomText] = useState('');
  const [lastSentText, setLastSentText] = useState<string | null>(null);

  const handleSend = async (msg: string) => {
    if (!msg.trim()) return;
    setLastSentText(msg);
    await sendQuickMessage(msg);
    setCustomText('');
  };

  // Messages sent by this user
  const myMessages = sosList.filter(p => p.userId === user?.userId);

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38BDF8',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#FFF' }}>💬 OFFLINE CHAT</div>
        <div style={{ width: 40 }}></div>
      </div>

      <HardwareStatusStrip />

      {/* Notice */}
      <div style={{
        background: 'rgba(56, 189, 248, 0.1)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 12,
        padding: '8px 12px',
        fontSize: 11,
        color: '#BAE6FD',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        <div style={{ fontWeight: 700 }}>📡 MESH DIRECT BROADCAST</div>
        <div>Messages are delivered via Store-Carry-Forward mesh. Coords ({location.latitude}, {location.longitude}) and Device ID auto-attached.</div>
      </div>

      {/* Predefined 1-Tap Emergency Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
          Tap to Broadcast Instantly:
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8
        }}>
          {PREDEFINED_MESSAGES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSend(item.text)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#FFF',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={16} color={item.color} style={{ flexShrink: 0 }} />
                <span>{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Custom Input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Optional custom message..."
          style={{
            flex: 1,
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-card)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#FFF',
            fontSize: 13,
            outline: 'none'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(customText);
          }}
        />
        <button
          onClick={() => handleSend(customText)}
          style={{
            background: 'linear-gradient(135deg, #0284C7, #0369A1)',
            border: 'none',
            borderRadius: 10,
            padding: '0 16px',
            color: '#FFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Recent Mesh Messages History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
          Sent Emergency Messages ({myMessages.length}):
        </div>

        {myMessages.length === 0 ? (
          <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: '16px' }}>
            No messages sent yet. Tap any preset above.
          </div>
        ) : (
          myMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 12,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ fontFamily: 'monospace', color: '#38BDF8', fontWeight: 700 }}>
                  {msg.id}
                </span>
                <span style={{ color: '#94A3B8' }}>{msg.timeFormatted}</span>
              </div>
              <div style={{ color: '#FFF', fontWeight: 600, fontSize: 13 }}>
                "{msg.message}"
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748B' }}>
                <span>Status: {msg.status}</span>
                <span>Hops: {msg.hopCount}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

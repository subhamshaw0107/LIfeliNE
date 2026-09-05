import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, QrCode, Download, X, Copy, Check, ExternalLink, ShieldCheck, Wifi } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const InstallOnPhoneModal: React.FC<Props> = ({ onClose }) => {
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const publicUrl = 'https://9f642cf2b630b7.lhr.life';
  const localWifiUrl = 'http://10.139.11.1:5173/';
  // Public QR code URL generator for easy scanning
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(publicUrl)}&bgcolor=0B0F19&color=38BDF8`;

  const handleCopyPublic = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedPublic(true);
    setTimeout(() => setCopiedPublic(false), 2000);
  };

  const handleCopyWifi = () => {
    navigator.clipboard.writeText(localWifiUrl);
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2000);
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '490px',
          maxHeight: '88vh',
          background: 'linear-gradient(180deg, #111827 0%, #0B1120 100%)',
          border: '1px solid #38BDF8',
          borderRadius: '16px',
          boxShadow: '0 0 40px rgba(56, 189, 248, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header (Fixed at top) */}
        <div
          style={{
            flexShrink: 0,
            background: 'rgba(56, 189, 248, 0.12)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} color="#38BDF8" />
            <span style={{ fontWeight: 800, fontSize: 13, color: '#FFF', letterSpacing: '0.02em' }}>
              INSTALL & RUN ON REAL MOBILE PHONE
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 28,
              height: 28,
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          {/* Method 1: Instant Scan & Install as WebAPK */}
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 12,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#38BDF8', color: '#000', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                METHOD 1 (RECOMMENDED)
              </span>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#FFF' }}>
                1-Tap Standalone Android App Install
              </span>
            </div>

            <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.4 }}>
              Open either link below in your phone's browser (Chrome / Safari / Brave):
            </div>

            {/* Public Tunnel Link (Any connection) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={12} />
                <span>ONLINE LINK (Mobile 4G/5G or any Wi-Fi):</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#0F172A',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 8,
                  padding: '6px 10px'
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38BDF8',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    flex: 1,
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleCopyPublic}
                  style={{
                    background: copiedPublic ? '#10B981' : 'rgba(56, 189, 248, 0.25)',
                    border: 'none',
                    color: '#FFF',
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {copiedPublic ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedPublic ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Local Wi-Fi Link (Same Wi-Fi network) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Wifi size={12} />
                <span>LOCAL WI-FI LINK (When connected to same Wi-Fi / hotspot):</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#0F172A',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 8,
                  padding: '6px 10px'
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={localWifiUrl}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#10B981',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    flex: 1,
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleCopyWifi}
                  style={{
                    background: copiedWifi ? '#10B981' : 'rgba(16, 185, 129, 0.25)',
                    border: 'none',
                    color: '#FFF',
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {copiedWifi ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedWifi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* QR Code and Steps */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
              <div
                style={{
                  background: '#0B0F19',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 10,
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={qrCodeImgUrl}
                  alt="Scan to open on phone"
                  width={120}
                  height={120}
                  style={{ borderRadius: 6, display: 'block' }}
                />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180, fontSize: 11, color: '#CBD5E1' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <strong style={{ color: '#38BDF8' }}>1.</strong>
                  <span>Scan the QR code with your phone camera or visit the link.</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <strong style={{ color: '#38BDF8' }}>2.</strong>
                  <span>Tap <strong>"Install app"</strong> banner (or menu ⋮ → <strong>"Install app"</strong>).</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <strong style={{ color: '#38BDF8' }}>3.</strong>
                  <span>Android automatically installs it as a standalone app with an icon on your home screen!</span>
                </div>
              </div>
            </div>
          </div>

          {/* Method 2: Standalone .APK via PWABuilder */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: '#10B981', color: '#000', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                METHOD 2
              </span>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#FFF' }}>
                Download Standalone Android APK (.apk file)
              </span>
            </div>

            <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>
              To download a physical <code>.apk</code> installer file to share or sideload:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: '#CBD5E1' }}>
              <div>
                • <strong>PWABuilder Cloud Packaging:</strong> Open <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" style={{ color: '#38BDF8', textDecoration: 'underline' }}>PWABuilder.com</a>, enter <code>{publicUrl}</code>, and click <strong>Package for Stores → Android</strong> to get your signed APK.
              </div>
              <div>
                • <strong>Capacitor / Bubblewrap:</strong> Run <code>npx @bubblewrap/cli init</code> to build a native APK package via CLI.
              </div>
            </div>
          </div>

        </div>

        {/* Footer (Fixed at bottom) */}
        <div
          style={{
            flexShrink: 0,
            background: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid var(--border-card)',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#0284C7',
              border: 'none',
              color: '#FFF',
              padding: '7px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close & Continue
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

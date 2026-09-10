import React, { useState } from 'react';
import { Sun, Moon, ArrowRight, Check, Shield, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface Props {
  onThemeSelected: (theme: 'light' | 'dark') => void;
}

export const ThemeSelectionScreen: React.FC<Props> = ({ onThemeSelected }) => {
  const { theme, setTheme } = useApp();
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('lifeline_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return theme || 'dark';
  });

  const handleSelect = (mode: 'light' | 'dark') => {
    setSelectedTheme(mode);
    setTheme(mode);
  };

  const handleContinue = () => {
    localStorage.setItem('lifeline_theme', selectedTheme);
    localStorage.setItem('lifeline_theme_selected', 'true');
    setTheme(selectedTheme);
    onThemeSelected(selectedTheme);
  };

  return (
    <div
      className="lifeline-auth-page"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9995,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 18px',
        overflowY: 'auto',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {/* Background Star Ambient & Atmospheric Glow */}
      <div className="splash-stars-bg" />
      <div className="auth-earth-curvature" />

      {/* Top Header: LIFELINE Branding */}
      <div className="auth-brand-header" style={{ marginBottom: 14 }}>
        <div className="auth-brand-icon">
          <Shield size={26} color="#38BDF8" />
        </div>
        <h1 className="auth-brand-title">LIFELINE</h1>
        <div className="auth-brand-subtitle">
          OFFLINE DISASTER RESCUE NETWORK
        </div>
      </div>

      {/* Main Glass Card */}
      <div className="auth-card-wrapper" style={{ maxWidth: '380px' }}>
        <div className="auth-glass-card" style={{ padding: '24px 20px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '1.5px',
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '3px 10px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                marginBottom: 8
              }}
            >
              <Sparkles size={11} />
              <span>Appearance Setup</span>
            </div>

            <h2
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '0.5px',
                margin: '0 0 6px 0'
              }}
            >
              Choose Your Theme
            </h2>
            <p
              style={{
                fontSize: 12,
                color: '#94A3B8',
                margin: 0,
                lineHeight: 1.4
              }}
            >
              Select your preferred appearance for better visibility.
            </p>
          </div>

          {/* Theme Options Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
            {/* Option 1: ☀ Light Mode */}
            <button
              type="button"
              onClick={() => handleSelect('light')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '16px',
                background: selectedTheme === 'light'
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(241, 245, 249, 0.92))'
                  : 'rgba(255, 255, 255, 0.05)',
                border: selectedTheme === 'light'
                  ? '2px solid #38BDF8'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: selectedTheme === 'light'
                  ? '0 0 24px rgba(56, 189, 248, 0.35), 0 8px 20px rgba(0, 0, 0, 0.25)'
                  : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: selectedTheme === 'light' ? 'scale(1.02)' : 'scale(1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: selectedTheme === 'light'
                      ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                      : 'rgba(245, 158, 11, 0.15)',
                    color: selectedTheme === 'light' ? '#FFFFFF' : '#FBBF24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: selectedTheme === 'light'
                      ? '0 4px 12px rgba(245, 158, 11, 0.35)'
                      : 'none',
                    flexShrink: 0
                  }}
                >
                  <Sun size={24} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: selectedTheme === 'light' ? '#0F172A' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>Light Mode</span>
                    {selectedTheme === 'light' && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: '#2563EB',
                          color: '#FFF',
                          padding: '2px 6px',
                          borderRadius: 6,
                          letterSpacing: 0.5
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: selectedTheme === 'light' ? '#475569' : '#94A3B8',
                      marginTop: 2
                    }}
                  >
                    Clean daylight UI • High outdoor visibility
                  </div>
                </div>
              </div>

              {/* Radio Indicator */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: selectedTheme === 'light' ? '#0284C7' : 'rgba(255, 255, 255, 0.1)',
                  border: selectedTheme === 'light' ? 'none' : '1.5px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0
                }}
              >
                {selectedTheme === 'light' && <Check size={15} strokeWidth={3} />}
              </div>
            </button>

            {/* Option 2: 🌙 Dark Mode */}
            <button
              type="button"
              onClick={() => handleSelect('dark')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '16px',
                background: selectedTheme === 'dark'
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 28, 0.98))'
                  : 'rgba(255, 255, 255, 0.05)',
                border: selectedTheme === 'dark'
                  ? '2px solid #38BDF8'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: selectedTheme === 'dark'
                  ? '0 0 24px rgba(56, 189, 248, 0.35), 0 8px 20px rgba(0, 0, 0, 0.5)'
                  : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: selectedTheme === 'dark' ? 'scale(1.02)' : 'scale(1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: selectedTheme === 'dark'
                      ? 'linear-gradient(135deg, #38BDF8, #0284C7)'
                      : 'rgba(56, 189, 248, 0.15)',
                    color: selectedTheme === 'dark' ? '#FFFFFF' : '#38BDF8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: selectedTheme === 'dark'
                      ? '0 4px 12px rgba(56, 189, 248, 0.35)'
                      : 'none',
                    flexShrink: 0
                  }}
                >
                  <Moon size={22} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>Dark Mode</span>
                    {selectedTheme === 'dark' && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: '#0284C7',
                          color: '#FFF',
                          padding: '2px 6px',
                          borderRadius: 6,
                          letterSpacing: 0.5
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#94A3B8',
                      marginTop: 2
                    }}
                  >
                    Low-glare tactical • Battery conservation
                  </div>
                </div>
              </div>

              {/* Radio Indicator */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: selectedTheme === 'dark' ? '#38BDF8' : 'rgba(255, 255, 255, 0.1)',
                  border: selectedTheme === 'dark' ? 'none' : '1.5px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: selectedTheme === 'dark' ? '#07090E' : '#FFFFFF',
                  flexShrink: 0
                }}
              >
                {selectedTheme === 'dark' && <Check size={15} strokeWidth={3} />}
              </div>
            </button>
          </div>

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleContinue}
            className="auth-primary-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #0284C7, #0369A1)',
              boxShadow: '0 6px 20px rgba(2, 132, 199, 0.45)',
              padding: '14px 20px',
              borderRadius: '14px',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '1px'
            }}
          >
            <span>CONTINUE</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
};

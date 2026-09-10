import React, { useState } from 'react';
import { Globe, Check, ArrowRight, Radio } from 'lucide-react';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' }
];

interface Props {
  onLanguageSelected: (langCode: string) => void;
}

export const LanguageSelectionScreen: React.FC<Props> = ({ onLanguageSelected }) => {
  const [selectedLang, setSelectedLang] = useState<string>(() => {
    return localStorage.getItem('lifeline_user_lang') || 'en';
  });

  const handleConfirm = () => {
    localStorage.setItem('lifeline_user_lang', selectedLang);
    onLanguageSelected(selectedLang);
  };

  return (
    <div className="lifeline-auth-page">
      {/* Background Star & Earth Ambient */}
      <div className="splash-stars-bg" />
      <div className="auth-earth-curvature" />

      {/* Top Header: LIFELINE Branding */}
      <div className="auth-brand-header">
        <div className="auth-brand-icon">
          <Globe size={26} color="#38BDF8" />
        </div>
        <h1 className="auth-brand-title">LIFELINE</h1>
        <div className="auth-brand-subtitle">
          OFFLINE DISASTER RESCUE NETWORK
        </div>
      </div>

      {/* Language Card */}
      <div className="auth-card-wrapper">
        <div className="auth-glass-card">
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>
              SELECT LANGUAGE
            </h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
              Choose your language for emergency alerts & instructions
            </p>
          </div>

          {/* Language Options Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {LANGUAGES.map(lang => {
              const isSelected = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLang(lang.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(4, 7, 17, 0.65)',
                    border: isSelected ? '1.5px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{lang.flag}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isSelected ? '#FFFFFF' : '#E2E8F0' }}>
                        {lang.nativeName}
                      </div>
                      <div style={{ fontSize: 11, color: isSelected ? '#7DD3FC' : '#64748B' }}>
                        {lang.name}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: isSelected ? '#38BDF8' : 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0B101D'
                    }}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="auth-primary-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #0284C7, #0369A1)',
              boxShadow: '0 4px 18px rgba(2, 132, 199, 0.4)'
            }}
          >
            <span>CONTINUE TO LOGIN</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

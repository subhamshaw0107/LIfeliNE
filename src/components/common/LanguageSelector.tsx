import React from 'react';
import { useApp } from '../../context/AppContext';
import { LanguageCode } from '../../i18n/translations';
import { Globe } from 'lucide-react';

interface Props {
  className?: string;
  compact?: boolean;
}

export const LanguageSelector: React.FC<Props> = ({ className = '', compact = false }) => {
  const { language, setLanguage } = useApp();

  const options: { code: LanguageCode; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'bn', label: 'বাংলা' }
  ];

  return (
    <div
      className={`language-selector-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-card)',
        borderRadius: 24,
        padding: '3px 4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}
    >
      <div style={{ padding: '0 6px', display: 'flex', alignItems: 'center', color: 'var(--text-sub)' }}>
        <Globe size={15} />
      </div>
      {options.map((opt) => {
        const isActive = language === opt.code;
        return (
          <button
            key={opt.code}
            onClick={() => setLanguage(opt.code)}
            style={{
              background: isActive ? '#2563EB' : 'transparent',
              color: isActive ? '#FFFFFF' : 'var(--text-sub)',
              border: 'none',
              borderRadius: 20,
              padding: compact ? '4px 10px' : '5px 12px',
              fontSize: compact ? 12 : 13,
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s'
            }}
            aria-label={`Select language ${opt.label}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sun, Moon } from 'lucide-react';

interface Props {
  className?: string;
  compact?: boolean;
}

export const ThemeSelector: React.FC<Props> = ({ className = '', compact = false }) => {
  const { theme, setTheme } = useApp();

  return (
    <div
      className={`theme-selector-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-card)',
        borderRadius: 24,
        padding: '3px 4px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        gap: 2
      }}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: theme === 'light' ? '#2563EB' : 'transparent',
          color: theme === 'light' ? '#FFFFFF' : 'var(--text-sub)',
          border: 'none',
          borderRadius: 20,
          padding: compact ? '4px 9px' : '5px 12px',
          fontSize: compact ? 11 : 12,
          fontWeight: theme === 'light' ? 700 : 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        aria-label="Switch to Light Theme"
        title="Light Mode"
      >
        <Sun size={compact ? 13 : 14} />
        <span>Light</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: theme === 'dark' ? '#0284C7' : 'transparent',
          color: theme === 'dark' ? '#FFFFFF' : 'var(--text-sub)',
          border: 'none',
          borderRadius: 20,
          padding: compact ? '4px 9px' : '5px 12px',
          fontSize: compact ? 11 : 12,
          fontWeight: theme === 'dark' ? 700 : 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        aria-label="Switch to Dark Theme"
        title="Dark Mode"
      >
        <Moon size={compact ? 13 : 14} />
        <span>Dark</span>
      </button>
    </div>
  );
};

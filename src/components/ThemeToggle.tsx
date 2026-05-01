'use client';

import { Theme } from '@/hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
  size?: number;
}

export default function ThemeToggle({ theme, onToggle, size = 20 }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  return (
    <button onClick={onToggle} title={isDark ? 'ライトモード' : 'ダークモード'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
        transition: 'color 0.3s ease',
      }}>
      {isDark ? (
        /* 月アイコン (ダークモード時 → 押すとライトに) */
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ) : (
        /* 太陽アイコン (ライトモード時 → 押すとダークに) */
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      )}
    </button>
  );
}

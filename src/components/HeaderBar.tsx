'use client';

import { useRef } from 'react';
import { Container } from '@/lib/types';

interface HeaderBarProps {
  containers: Container[];
  selectedIdx: number;
  onSelectContainer: (idx: number) => void;
  onFileReload: (file: File) => void;
  clock: string;
  elapsed: string;
  autoAnnounce: boolean;
  onToggleAutoAnnounce: () => void;
  onMenuToggle: () => void;
}

export default function HeaderBar({
  containers,
  selectedIdx,
  onSelectContainer,
  onFileReload,
  clock,
  elapsed,
  autoAnnounce,
  onToggleAutoAnnounce,
  onMenuToggle,
}: HeaderBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="app-header">
      {/* ハンバーガーメニュー */}
      <button onClick={onMenuToggle} className="header-btn" title="メニュー">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* ファイル読込 */}
      <button onClick={() => inputRef.current?.click()} className="header-btn" title="ファイル読込">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="12" y2="12"/>
          <line x1="15" y1="15" x2="12" y2="12"/>
        </svg>
      </button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileReload(f); e.target.value = ''; }}
        className="hidden" />

      {/* コンテナ選択 */}
      <select value={selectedIdx} onChange={(e) => onSelectContainer(Number(e.target.value))} className="header-select">
        {containers.map((c, i) => (
          <option key={c.containerNo} value={i}>
            {c.containerNo} ({c.date.slice(5).replace('-', '/')})
          </option>
        ))}
      </select>

      <div className="flex-1" />

      <span className="header-time">{clock}</span>
      <span className="header-elapsed">{elapsed}</span>

      <button onClick={onToggleAutoAnnounce} className="header-btn"
        style={{
          background: autoAnnounce ? 'rgba(34,197,94,0.1)' : undefined,
          borderColor: autoAnnounce ? 'rgba(34,197,94,0.25)' : undefined,
          color: autoAnnounce ? '#16a34a' : undefined,
        }}
        title={autoAnnounce ? '自動読上げ ON' : '自動読上げ OFF'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {autoAnnounce ? (
            <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
          ) : (
            <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
          )}
        </svg>
      </button>
    </div>
  );
}

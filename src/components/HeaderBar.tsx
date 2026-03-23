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
}: HeaderBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center h-10 px-2 bg-gray-800 text-white text-sm gap-2 shrink-0">
      {/* ファイル読込 */}
      <button
        onClick={() => inputRef.current?.click()}
        className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 min-w-[48px] min-h-[32px]"
        title="ファイル読込"
      >
        📁
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileReload(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* コンテナ選択 */}
      <select
        value={selectedIdx}
        onChange={(e) => onSelectContainer(Number(e.target.value))}
        className="bg-gray-700 text-white rounded px-2 py-1 text-sm min-h-[32px]"
      >
        {containers.map((c, i) => (
          <option key={c.containerNo} value={i}>
            {c.containerNo} ({c.date.slice(5).replace('-', '/')})
          </option>
        ))}
      </select>

      <div className="flex-1" />

      {/* 現在時刻 */}
      <span className="text-gray-300" title="現在時刻">
        🕐 {clock}
      </span>

      {/* 経過時間 */}
      <span className="text-yellow-300 font-mono" title="経過時間">
        ⏱ {elapsed}
      </span>

      {/* 自動読上げ */}
      <button
        onClick={onToggleAutoAnnounce}
        className={`px-2 py-1 rounded min-w-[48px] min-h-[32px] ${
          autoAnnounce ? 'bg-green-700' : 'bg-gray-700'
        }`}
        title={autoAnnounce ? '自動読上げ ON' : '自動読上げ OFF'}
      >
        {autoAnnounce ? '🔊' : '🔇'}
      </button>
    </div>
  );
}

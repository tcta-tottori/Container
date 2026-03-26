'use client';

import { useRef, useState, useEffect } from 'react';
import { Container } from '@/lib/types';
import { CompletionLogEntry } from '@/hooks/useContainerData';

export interface ItemTimeLog {
  itemName: string;
  elapsed: number; // seconds
  timestamp: number;
}

interface HeaderBarProps {
  containers: Container[];
  selectedIdx: number;
  onSelectContainer: (idx: number) => void;
  onFileReload?: (file: File) => void;
  workElapsed: string;
  workRawSeconds: number;
  onMenuToggle: () => void;
  onResetWorkTimer: () => void;
  itemTimeLogs: ItemTimeLog[];
  completionLog: CompletionLogEntry[];
  onContainerAnnounce?: () => void;
  hasItems?: boolean;
}

export default function HeaderBar({
  containers,
  selectedIdx,
  onSelectContainer,
  workElapsed,
  workRawSeconds,
  onMenuToggle,
  onResetWorkTimer,
  itemTimeLogs,
  completionLog,
}: HeaderBarProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const lastFlashedAt = useRef(0);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // リアルタイム時計+日付
  useEffect(() => {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const update = () => {
      const now = new Date();
      setCurrentTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setCurrentDate(`${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}(${days[now.getDay()]})`);
    };
    update();
    const iv = setInterval(update, 10000);
    return () => clearInterval(iv);
  }, []);

  // 5分ごとに黄色点滅（5秒間）
  useEffect(() => {
    if (workRawSeconds > 0 && workRawSeconds % 300 === 0 && lastFlashedAt.current !== workRawSeconds) {
      lastFlashedAt.current = workRawSeconds;
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [workRawSeconds]);

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

      {/* コンテナ選択 */}
      <select value={selectedIdx} onChange={(e) => onSelectContainer(Number(e.target.value))} className="header-select">
        {containers.map((c, i) => (
          <option key={c.containerNo} value={i}>
            {c.containerNo} ({c.date.slice(5).replace('-', '/')})
          </option>
        ))}
      </select>

      <div className="flex-1" />

      {/* 日付（横画面のみ）+ 経過時間（黄色）+ リアルタイム時計 */}
      <span className="header-date-landscape" style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
        color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginRight: 8,
      }}>
        {currentDate}
      </span>
      <span
        className={`header-work-elapsed ${isFlashing ? 'header-elapsed-flash' : ''}`}
        style={{ color: '#f59e0b', marginRight: 6, flexShrink: 0 }}
      >
        {workElapsed}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
        color: 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums',
        letterSpacing: 0.5, flexShrink: 0, marginRight: 16,
      }}>
        {currentTime}
      </span>

      {/* 経過時間ポップアップ */}
      {popupOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setPopupOpen(false)}>
          <div style={{
            background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: '20px 24px', minWidth: 280, maxWidth: '90vw',
            maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            {/* 経過時間表示 */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>作業経過時間</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                {workElapsed}
              </div>
            </div>

            {/* リセットボタン */}
            <button
              onClick={() => { onResetWorkTimer(); setPopupOpen(false); }}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, padding: '10px 16px', color: '#ef4444',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 16,
              }}
            >
              経過時間をリセット
            </button>

            {/* 品名別消費時間 */}
            {itemTimeLogs.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>品名別消費時間</div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {itemTimeLogs.map((log, i) => {
                    const m = Math.floor(log.elapsed / 60);
                    const s = log.elapsed % 60;
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                          {log.itemName}
                        </span>
                        <span style={{ color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                          {m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* 完了品目 */}
            {completionLog.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, marginTop: 12 }}>完了品目</div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {completionLog.map((entry, i) => {
                    const m = Math.floor(entry.duration / 60);
                    const s = entry.duration % 60;
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0, marginRight: 8, minWidth: 24 }}>
                          #{i + 1}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                          {entry.name}
                        </span>
                        <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                          {m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* 閉じるボタン */}
            <button
              onClick={() => setPopupOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '10px 16px', color: 'rgba(255,255,255,0.7)',
                fontWeight: 500, fontSize: 13, cursor: 'pointer', marginTop: 12,
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

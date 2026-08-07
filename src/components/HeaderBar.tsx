'use client';

import { useRef, useState, useEffect } from 'react';
import { CompletionLogEntry } from '@/hooks/useContainerData';
import { WeatherData, wbgtLevel } from '@/lib/weatherNews';
import { SwitchBotReading } from '@/lib/switchbot';
import { MenuIcon } from '@/components/AppIcons';

export interface ItemTimeLog {
  itemName: string;
  elapsed: number; // seconds
  timestamp: number;
}

interface HeaderBarProps {
  workElapsed: string;
  workRawSeconds: number;
  onMenuToggle: () => void;
  onResetWorkTimer: () => void;
  itemTimeLogs: ItemTimeLog[];
  completionLog: CompletionLogEntry[];
  /** ヘッダー右の気温表示（気象庁データ） */
  weather?: WeatherData | null;
  /** SwitchBot の実測値。あれば実測を優先して表示する */
  switchbot?: SwitchBotReading | null;
  /** 気温表示のタップ（詳細ポップアップを開く） */
  onOpenClimate?: () => void;
}

const TEMP_COLOR = '#fb923c'; // 気温（オレンジ）
const HUM_COLOR = '#38bdf8';  // 湿度（水色）

/** ヘッダー右: 気温・湿度の数値 + 暑さ指数の色バッジ */
function HeaderClimate({
  weather, switchbot, onOpen,
}: {
  weather?: WeatherData | null;
  switchbot?: SwitchBotReading | null;
  onOpen?: () => void;
}) {
  const r = switchbot || weather;
  if (!r) return null;
  const lv = wbgtLevel(r.wbgt);
  return (
    <button className="header-climate" onClick={onOpen} title="タップで詳細を表示">
      {switchbot && <span className="header-climate-src">S</span>}
      <span className="header-climate-val">
        <span className="header-climate-num" style={{ color: TEMP_COLOR }}>
          {r.temperature}<span className="header-climate-unit">°C</span>
        </span>
        <span className="header-climate-num" style={{ color: HUM_COLOR, fontSize: 15 }}>
          {Math.round(r.humidity)}<span className="header-climate-unit" style={{ fontSize: 11 }}>%</span>
        </span>
      </span>
      <span
        className="header-wbgt"
        style={{ background: `${lv.color}26`, border: `1.5px solid ${lv.color}`, color: lv.color }}
        title={`暑さ指数 ${r.wbgt}（${lv.label}）`}
      >
        <span className="header-wbgt-num">{r.wbgt}</span>
        <span className="header-wbgt-label">{lv.label}</span>
      </span>
    </button>
  );
}

export default function HeaderBar({
  workElapsed,
  workRawSeconds,
  onMenuToggle,
  onResetWorkTimer,
  itemTimeLogs,
  completionLog,
  weather,
  switchbot,
  onOpenClimate,
}: HeaderBarProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const lastFlashedAt = useRef(0);

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
      {/* 左: メニュー */}
      <div className="header-left">
        <button onClick={onMenuToggle} className="header-btn" title="メニュー" aria-label="メニュー">
          <MenuIcon size={24} strokeWidth={2} />
        </button>
      </div>

      {/* 中央: 経過時間 */}
      <div className="header-center">
        <button
          onClick={() => setPopupOpen(true)}
          className={`header-work-elapsed ${isFlashing ? 'header-elapsed-flash' : ''}`}
          style={{ background: 'transparent', cursor: 'pointer', padding: '4px 10px' }}
          title="タップで経過時間の詳細"
        >
          {workElapsed}
        </button>
      </div>

      {/* 右: 気温・湿度・暑さ指数 */}
      <div className="header-right">
        <HeaderClimate weather={weather} switchbot={switchbot} onOpen={onOpenClimate} />
      </div>

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

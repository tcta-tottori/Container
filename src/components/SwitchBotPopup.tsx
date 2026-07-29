'use client';

import { useEffect } from 'react';
import { WeatherData, wbgtLevel } from '@/lib/weatherNews';
import { SwitchBotReading, SwitchBotHistoryPoint } from '@/lib/switchbot';

interface SwitchBotPopupProps {
  reading: SwitchBotReading;
  /** 気象庁データ（差分表示用） */
  weather: WeatherData | null;
  /** 推移グラフ用の時系列 */
  history: SwitchBotHistoryPoint[];
  onClose: () => void;
}

const TEMP_COLOR = '#fb923c'; // 気温（オレンジ）
const HUM_COLOR = '#38bdf8';  // 湿度（水色）
const WBGT_COLOR = '#c084fc'; // 暑さ指数（紫）

function hhmm(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 気象庁との差分（SwitchBot − 気象庁） */
function DiffRow({ diff, unit }: { diff: number; unit: string }) {
  const r = Math.round(diff * 10) / 10;
  const sign = r > 0 ? '+' : '';
  const color = r > 0 ? '#f87171' : r < 0 ? '#60a5fa' : 'rgba(255,255,255,0.5)';
  return (
    <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.5)' }}>
      気象庁比{' '}
      <span style={{ color, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
        {sign}{r}{unit}
      </span>
    </div>
  );
}

/**
 * SwitchBot 温湿度計の詳細ポップアップ。
 * 現在値（気温・湿度・暑さ指数）を大きく表示し、気象庁との差、
 * および受信履歴の推移グラフを表示する。
 */
export default function SwitchBotPopup({ reading, weather, history, onClose }: SwitchBotPopupProps) {
  // ESC / 戻るで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lv = wbgtLevel(reading.wbgt);

  // グラフ用ポイント（履歴が空なら現在値のみ）
  const pts: SwitchBotHistoryPoint[] = history.length > 0
    ? history
    : [{ t: reading.updatedAt, temperature: reading.temperature, humidity: reading.humidity, wbgt: reading.wbgt }];

  // チャート寸法
  const W = 340, Hgt = 188;
  const padL = 34, padR = 42, padT = 16, padB = 26;
  const innerW = W - padL - padR;
  const innerH = Hgt - padT - padB;

  const tMin = pts[0].t;
  const tMax = pts[pts.length - 1].t;
  const tSpan = tMax - tMin;
  const xOf = (t: number) => (tSpan > 0 ? padL + ((t - tMin) / tSpan) * innerW : padL + innerW);

  const temps = pts.map((p) => p.temperature);
  const hums = pts.map((p) => p.humidity);
  const wbgts = pts.map((p) => p.wbgt);
  const leftVals = [...temps, ...wbgts];
  const tLo = Math.floor(Math.min(...leftVals) - 1);
  const tHi = Math.ceil(Math.max(...leftVals) + 1);
  const hLo = Math.max(0, Math.floor(Math.min(...hums) - 5));
  const hHi = Math.min(100, Math.ceil(Math.max(...hums) + 5));

  const clampY = (y: number) => Math.max(padT, Math.min(padT + innerH, y));
  const yTemp = (v: number) => clampY(padT + (1 - (v - tLo) / (tHi - tLo || 1)) * innerH);
  const yHum = (v: number) => clampY(padT + (1 - (v - hLo) / (hHi - hLo || 1)) * innerH);

  const tempLine = pts.map((p) => `${xOf(p.t)},${yTemp(p.temperature)}`).join(' ');
  const humLine = pts.map((p) => `${xOf(p.t)},${yHum(p.humidity)}`).join(' ');
  const wbgtLine = pts.map((p) => `${xOf(p.t)},${yTemp(p.wbgt)}`).join(' ');

  const tMid = Math.round((tLo + tHi) / 2);
  const hMid = Math.round((hLo + hHi) / 2);
  const tempTicks = [tHi, tMid, tLo];
  const humTicks = [hHi, hMid, hLo];

  // X軸の時刻ラベル（開始・中間・終了）
  const xTicks = tSpan > 0 ? [tMin, tMin + tSpan / 2, tMax] : [tMax];

  const last = pts[pts.length - 1];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.18s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #06251b 0%, #0c2a1f 55%, #071f18 100%)',
          border: '1.5px solid rgba(74,222,128,0.25)',
          borderRadius: 22, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ color: '#4ade80', fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>
            📡 SwitchBot 温湿度
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* 現在値（大きく表示） */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, borderRadius: 16, padding: '12px 12px', background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)' }}>
            <div style={{ color: TEMP_COLOR, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>気温</div>
            <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
              {reading.temperature}<span style={{ fontSize: 13, fontWeight: 600 }}>°C</span>
            </div>
            {weather && <DiffRow diff={reading.temperature - weather.temperature} unit="°" />}
          </div>
          <div style={{ flex: 1, borderRadius: 16, padding: '12px 12px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ color: HUM_COLOR, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>湿度</div>
            <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
              {reading.humidity}<span style={{ fontSize: 13, fontWeight: 600 }}>%</span>
            </div>
            {weather && <DiffRow diff={reading.humidity - weather.humidity} unit="%" />}
          </div>
        </div>

        {/* 暑さ指数 WBGT */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
          borderRadius: 16, padding: '12px 16px',
          background: `${lv.color}22`, border: `1px solid ${lv.color}66`,
        }}>
          <div>
            <div style={{ color: WBGT_COLOR, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>暑さ指数(WBGT)</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
              {reading.wbgt}<span style={{ fontSize: 12, fontWeight: 600 }}>℃</span>
            </div>
            {weather && <DiffRow diff={reading.wbgt - weather.wbgt} unit="" />}
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, background: lv.color, color: '#fff', fontSize: 15, fontWeight: 800 }}>
              {lv.label}
            </div>
            {reading.battery != null && (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4 }}>🔋 電池 {reading.battery}%</div>
            )}
          </div>
        </div>

        {/* 気象庁の参考値 */}
        {weather && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '8px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            fontSize: 11, color: 'rgba(255,255,255,0.6)',
          }}>
            <span style={{ fontWeight: 700 }}>🏢 気象庁</span>
            <span>気温 <b style={{ color: TEMP_COLOR }}>{weather.temperature}°</b></span>
            <span>湿度 <b style={{ color: HUM_COLOR }}>{weather.humidity}%</b></span>
            <span>暑さ <b style={{ color: WBGT_COLOR }}>{weather.wbgt}</b></span>
          </div>
        )}

        {/* 推移グラフ */}
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>
          SwitchBot 受信推移（{pts.length >= 2 ? `${hhmm(tMin)}〜${hhmm(tMax)}` : '記録中…'}）
        </div>
        {pts.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${Hgt}`} width="100%" style={{ display: 'block' }}>
            {/* 横グリッド */}
            {[0, 0.5, 1].map((f, i) => (
              <line key={i} x1={padL} x2={W - padR} y1={padT + f * innerH} y2={padT + f * innerH}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            ))}
            {/* 縦軸 */}
            <line x1={padL} x2={padL} y1={padT} y2={padT + innerH} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            <line x1={W - padR} x2={W - padR} y1={padT} y2={padT + innerH} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            {/* 左軸目盛り（気温/暑さ指数） */}
            {tempTicks.map((t, i) => (
              <g key={`t${i}`}>
                <line x1={padL - 3} x2={padL} y1={yTemp(t)} y2={yTemp(t)} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <text x={padL - 6} y={yTemp(t) + 3} fill="rgba(255,255,255,0.55)" fontSize={9} textAnchor="end">{t}°</text>
              </g>
            ))}
            {/* 右軸目盛り（湿度） */}
            {humTicks.map((h, i) => (
              <g key={`h${i}`}>
                <line x1={W - padR} x2={W - padR + 3} y1={yHum(h)} y2={yHum(h)} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <text x={W - padR + 6} y={yHum(h) + 3} fill={HUM_COLOR} fontSize={9} textAnchor="start">{h}%</text>
              </g>
            ))}
            {/* X軸時刻ラベル */}
            {xTicks.map((t, i) => (
              <text key={i} x={xOf(t)} y={Hgt - 8}
                fill="rgba(255,255,255,0.5)" fontSize={9}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
                {hhmm(t)}
              </text>
            ))}
            {/* ライン */}
            <polyline points={humLine} fill="none" stroke={HUM_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
            <polyline points={wbgtLine} fill="none" stroke={WBGT_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 3" />
            <polyline points={tempLine} fill="none" stroke={TEMP_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {/* 現在（最新）マーカー */}
            <circle cx={xOf(last.t)} cy={yHum(last.humidity)} r={4} fill={HUM_COLOR} stroke="#fff" strokeWidth={1.2} />
            <circle cx={xOf(last.t)} cy={yTemp(last.wbgt)} r={4} fill={WBGT_COLOR} stroke="#fff" strokeWidth={1.2} />
            <circle cx={xOf(last.t)} cy={yTemp(last.temperature)} r={4} fill={TEMP_COLOR} stroke="#fff" strokeWidth={1.2} />
          </svg>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
            推移を記録中です。しばらく受信すると変化がグラフに表示されます。
          </div>
        )}

        {/* 凡例 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: TEMP_COLOR }} />気温
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: HUM_COLOR }} />湿度
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: WBGT_COLOR }} />暑さ指数
          </span>
          {reading.rssi != null && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>電波 {reading.rssi}dBm</span>
          )}
        </div>
      </div>
    </div>
  );
}

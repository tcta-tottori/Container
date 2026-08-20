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

/* SwitchBot のブランドカラー（ロゴの赤） */
const SB_RED = '#d13938';

/* 赤背景の上で読めるように、線とテキストは明るい色に振っている */
const TEMP_COLOR = '#ffd166'; // 気温（明るい黄）
const HUM_COLOR = '#a5e8ff';  // 湿度（明るい水色）
const WBGT_COLOR = '#ffffff'; // 暑さ指数（白・破線）

function hhmm(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ロゴと同じ「S」マーク（白地に赤文字） */
function SwitchBotLogo({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: size * 0.26, flexShrink: 0,
        background: '#fff', color: SB_RED,
        fontSize: size * 0.72, fontWeight: 900, lineHeight: 1,
        fontFamily: 'var(--font-ui)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      S
    </span>
  );
}

/** 気象庁との差分（SwitchBot − 気象庁） */
function DiffRow({ diff, unit }: { diff: number; unit: string }) {
  const r = Math.round(diff * 10) / 10;
  const sign = r > 0 ? '+' : '';
  // 赤背景なので「高い＝黄」「低い＝水色」で見分ける
  const color = r > 0 ? '#ffe08a' : r < 0 ? '#c8ecff' : 'rgba(255,255,255,0.7)';
  return (
    <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.72)' }}>
      気象庁比{' '}
      <span style={{ color, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {sign}{r}{unit}
      </span>
    </div>
  );
}

/**
 * SwitchBot 温湿度計の詳細ポップアップ。
 * SwitchBot のロゴに合わせた赤背景で、現在値（気温・湿度・暑さ指数）と
 * 気象庁との差、受信履歴の推移グラフを表示する。
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

  /** 赤の上に置く半透明の白いカード */
  const card = {
    borderRadius: 16,
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.3)',
  } as const;

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
          background: `linear-gradient(165deg, #dc4b48 0%, ${SB_RED} 48%, #a82a29 100%)`,
          border: '1.5px solid rgba(255,255,255,0.32)',
          borderRadius: 22, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto',
          color: '#fff',
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <SwitchBotLogo size={30} />
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 800, letterSpacing: 0.5 }}>SwitchBot</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600 }}>温湿度計・実測値</div>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}
            aria-label="閉じる"
          >×</button>
        </div>

        {/* 現在値（大きく表示） */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ ...card, flex: 1, padding: '12px 12px' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>気温</div>
            <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {reading.temperature}<span style={{ fontSize: 13, fontWeight: 700 }}>°C</span>
            </div>
            {weather && <DiffRow diff={reading.temperature - weather.temperature} unit="°" />}
          </div>
          <div style={{ ...card, flex: 1, padding: '12px 12px' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>湿度</div>
            <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {reading.humidity}<span style={{ fontSize: 13, fontWeight: 700 }}>%</span>
            </div>
            {weather && <DiffRow diff={reading.humidity - weather.humidity} unit="%" />}
          </div>
        </div>

        {/* 暑さ指数 WBGT */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '12px 16px' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>暑さ指数(WBGT)</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {reading.wbgt}<span style={{ fontSize: 12, fontWeight: 700 }}>℃</span>
            </div>
            {weather && <DiffRow diff={reading.wbgt - weather.wbgt} unit="" />}
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            {/* 赤地では警戒色の背景が沈むので、白バッジ＋警戒色の文字にする */}
            <div style={{
              display: 'inline-block', padding: '5px 14px', borderRadius: 999,
              background: '#fff', color: lv.color, fontSize: 15, fontWeight: 900,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>
              {lv.label}
            </div>
            {reading.battery != null && (
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 5, fontWeight: 600 }}>
                電池 {reading.battery}%
              </div>
            )}
          </div>
        </div>

        {/* 気象庁の参考値 */}
        {weather && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            padding: '8px 12px', borderRadius: 12,
            background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.2)',
            fontSize: 11, color: 'rgba(255,255,255,0.85)',
          }}>
            <span style={{ fontWeight: 800 }}>気象庁</span>
            <span>気温 <b>{weather.temperature}°</b></span>
            <span>湿度 <b>{weather.humidity}%</b></span>
            <span>暑さ <b>{weather.wbgt}</b></span>
          </div>
        )}

        {/* 推移グラフ */}
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 6, fontWeight: 700 }}>
          SwitchBot 受信推移（{pts.length >= 2 ? `${hhmm(tMin)}〜${hhmm(tMax)}` : '記録中…'}）
        </div>
        {pts.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${Hgt}`} width="100%" style={{ display: 'block' }}>
            {/* 横グリッド */}
            {[0, 0.5, 1].map((f, i) => (
              <line key={i} x1={padL} x2={W - padR} y1={padT + f * innerH} y2={padT + f * innerH}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            ))}
            {/* 縦軸 */}
            <line x1={padL} x2={padL} y1={padT} y2={padT + innerH} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
            <line x1={W - padR} x2={W - padR} y1={padT} y2={padT + innerH} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
            {/* 左軸目盛り（気温/暑さ指数） */}
            {tempTicks.map((t, i) => (
              <g key={`t${i}`}>
                <line x1={padL - 3} x2={padL} y1={yTemp(t)} y2={yTemp(t)} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
                <text x={padL - 6} y={yTemp(t) + 3} fill="rgba(255,255,255,0.85)" fontSize={9} textAnchor="end">{t}°</text>
              </g>
            ))}
            {/* 右軸目盛り（湿度） */}
            {humTicks.map((h, i) => (
              <g key={`h${i}`}>
                <line x1={W - padR} x2={W - padR + 3} y1={yHum(h)} y2={yHum(h)} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
                <text x={W - padR + 6} y={yHum(h) + 3} fill={HUM_COLOR} fontSize={9} textAnchor="start">{h}%</text>
              </g>
            ))}
            {/* X軸時刻ラベル */}
            {xTicks.map((t, i) => (
              <text key={i} x={xOf(t)} y={Hgt - 8}
                fill="rgba(255,255,255,0.8)" fontSize={9}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
                {hhmm(t)}
              </text>
            ))}
            {/* ライン */}
            <polyline points={humLine} fill="none" stroke={HUM_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={wbgtLine} fill="none" stroke={WBGT_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 3" opacity={0.85} />
            <polyline points={tempLine} fill="none" stroke={TEMP_COLOR} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {/* 現在（最新）マーカー */}
            <circle cx={xOf(last.t)} cy={yHum(last.humidity)} r={4} fill={HUM_COLOR} stroke={SB_RED} strokeWidth={1.2} />
            <circle cx={xOf(last.t)} cy={yTemp(last.wbgt)} r={4} fill={WBGT_COLOR} stroke={SB_RED} strokeWidth={1.2} />
            <circle cx={xOf(last.t)} cy={yTemp(last.temperature)} r={4} fill={TEMP_COLOR} stroke={SB_RED} strokeWidth={1.2} />
          </svg>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
            推移を記録中です。しばらく受信すると変化がグラフに表示されます。
          </div>
        )}

        {/* 凡例 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: TEMP_COLOR }} />気温
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: HUM_COLOR }} />湿度
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: WBGT_COLOR }} />暑さ指数
          </span>
          {reading.rssi != null && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>電波 {reading.rssi}dBm</span>
          )}
        </div>
      </div>
    </div>
  );
}

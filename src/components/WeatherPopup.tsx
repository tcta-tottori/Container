'use client';

import { WeatherData } from '@/lib/weatherNews';

interface WeatherPopupProps {
  weather: WeatherData;
  onClose: () => void;
}

const TEMP_COLOR = '#fb923c'; // 気温（オレンジ）
const HUM_COLOR = '#38bdf8';  // 湿度（水色）

/** 気温・湿度と 8時〜12時の推移グラフを温湿度アプリ風に表示するポップアップ */
export default function WeatherPopup({ weather, onClose }: WeatherPopupProps) {
  const pts = weather.hourly;

  // 現在時刻の位置（8〜12時にクランプ）
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const H0 = 8, H1 = 12;
  const clamped = Math.max(H0, Math.min(H1, nowH));
  const inRange = nowH >= H0 && nowH <= H1;

  // チャート寸法
  const W = 320, Hgt = 180;
  const padL = 32, padR = 34, padT = 16, padB = 26;
  const innerW = W - padL - padR;
  const innerH = Hgt - padT - padB;

  const xOf = (hour: number) => padL + ((hour - H0) / (H1 - H0)) * innerW;

  const temps = pts.map((p) => p.temperature);
  const hums = pts.map((p) => p.humidity);
  const tLo = temps.length ? Math.floor(Math.min(...temps) - 1) : 0;
  const tHi = temps.length ? Math.ceil(Math.max(...temps) + 1) : 40;
  const hLo = hums.length ? Math.max(0, Math.floor(Math.min(...hums) - 5)) : 0;
  const hHi = hums.length ? Math.min(100, Math.ceil(Math.max(...hums) + 5)) : 100;

  const clampY = (y: number) => Math.max(padT, Math.min(padT + innerH, y));
  const yTemp = (t: number) => clampY(padT + (1 - (t - tLo) / (tHi - tLo || 1)) * innerH);
  const yHum = (h: number) => clampY(padT + (1 - (h - hLo) / (hHi - hLo || 1)) * innerH);

  const tempLine = pts.map((p) => `${xOf(p.hour)},${yTemp(p.temperature)}`).join(' ');
  const humLine = pts.map((p) => `${xOf(p.hour)},${yHum(p.humidity)}`).join(' ');

  const curX = xOf(clamped);

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
          background: 'linear-gradient(160deg, #0d1b2a 0%, #12233a 55%, #0e1830 100%)',
          border: '1.5px solid rgba(255,255,255,0.14)',
          borderRadius: 22, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          width: '100%', maxWidth: 400,
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>
            けたか町 温湿度
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 現在値（大きく表示） */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{
            flex: 1, borderRadius: 16, padding: '14px 16px',
            background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)',
          }}>
            <div style={{ color: TEMP_COLOR, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>気温</div>
            <div style={{ color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
              {weather.temperature}<span style={{ fontSize: 15, fontWeight: 600 }}>°C</span>
            </div>
          </div>
          <div style={{
            flex: 1, borderRadius: 16, padding: '14px 16px',
            background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)',
          }}>
            <div style={{ color: HUM_COLOR, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>湿度</div>
            <div style={{ color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
              {weather.humidity}<span style={{ fontSize: 15, fontWeight: 600 }}>%</span>
            </div>
          </div>
        </div>

        {/* 推移グラフ 8時〜12時 */}
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>
          本日 8時〜12時の推移
        </div>
        {pts.length > 0 ? (
          <svg viewBox={`0 0 ${W} ${Hgt}`} width="100%" style={{ display: 'block' }}>
            {/* グリッド（横） */}
            {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
              <line key={i}
                x1={padL} x2={W - padR}
                y1={padT + f * innerH} y2={padT + f * innerH}
                stroke="rgba(255,255,255,0.08)" strokeWidth={1}
              />
            ))}
            {/* X軸ラベル + 縦グリッド */}
            {[8, 9, 10, 11, 12].map((hh) => (
              <g key={hh}>
                <line x1={xOf(hh)} x2={xOf(hh)} y1={padT} y2={padT + innerH}
                  stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                <text x={xOf(hh)} y={Hgt - 8} fill="rgba(255,255,255,0.5)" fontSize={10} textAnchor="middle">
                  {hh}時
                </text>
              </g>
            ))}

            {/* 温度・湿度ライン */}
            <polyline points={humLine} fill="none" stroke={HUM_COLOR} strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
            <polyline points={tempLine} fill="none" stroke={TEMP_COLOR} strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round" />

            {/* 各点のドット */}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={xOf(p.hour)} cy={yHum(p.humidity)} r={2.5} fill={HUM_COLOR} />
                <circle cx={xOf(p.hour)} cy={yTemp(p.temperature)} r={2.5} fill={TEMP_COLOR} />
              </g>
            ))}

            {/* 現在位置マーカー */}
            {inRange && (
              <g>
                <line x1={curX} x2={curX} y1={padT} y2={padT + innerH}
                  stroke="#fff" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />
                <circle cx={curX} cy={yTemp(weather.temperature)} r={4.5} fill={TEMP_COLOR} stroke="#fff" strokeWidth={1.5} />
                <circle cx={curX} cy={yHum(weather.humidity)} r={4.5} fill={HUM_COLOR} stroke="#fff" strokeWidth={1.5} />
                <text x={Math.min(curX, W - padR - 10)} y={padT + 9} fill="#fff" fontSize={9} textAnchor="middle" fontWeight="700">
                  現在
                </text>
              </g>
            )}
          </svg>
        ) : (
          <div style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center',
            padding: '24px 0',
          }}>
            推移データを取得できませんでした
          </div>
        )}

        {/* 凡例 + 補足 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: TEMP_COLOR }} />気温
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: HUM_COLOR }} />湿度
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            降水{weather.precipitationProb}% / 風速{weather.windSpeed}m
          </span>
        </div>
      </div>
    </div>
  );
}

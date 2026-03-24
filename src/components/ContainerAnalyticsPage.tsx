'use client';

import { useEffect, useRef, useState } from 'react';
import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface ContainerAnalyticsPageProps {
  items: ContainerItem[];
  completedIds: Set<string>;
  containerNo: string;
}

/* ===== コンテナスペック ===== */
const CONTAINERS: Record<string, { name: string; cbm: number; maxKg: number; heightRatio: number }> = {
  '20FT': { name: "20' DRY", cbm: 33.2, maxKg: 21770, heightRatio: 0.72 },
  '40FT': { name: "40' DRY", cbm: 67.7, maxKg: 26680, heightRatio: 0.82 },
  '40HQ': { name: "40' HIGH CUBE", cbm: 76.3, maxKg: 26460, heightRatio: 1.0 },
};

/* ===== 寸法パース ===== */
function parseMeas(meas: string): [number, number, number] | null {
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/* ===== アニメーション付きカウント ===== */
function AnimatedNumber({ value, color, size = 36, delay = 0 }: {
  value: number; color: string; size?: number; delay?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = ref.current;
      const diff = value - start;
      if (diff === 0) return;
      const duration = 600;
      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + diff * eased);
        setDisplay(current);
        ref.current = current;
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return (
    <span style={{
      fontSize: size, fontWeight: 900, fontFamily: 'var(--font-mono)', color,
      textShadow: `0 0 20px ${color}40`,
    }}>
      {display}
    </span>
  );
}

/* ===== プログレスバー ===== */
function ProgressBar({ value, max, color, label, subLabel }: {
  value: number; max: number; color: string; label: string; subLabel?: string;
}) {
  const pct = max > 0 ? Math.min(value / max * 100, 100) : 0;
  const isOver = value > max;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: isOver ? '#ef4444' : color }}>
          {value.toFixed(1)} / {max.toFixed(1)} {subLabel || ''}
        </span>
      </div>
      <div style={{
        height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 4, width: `${pct}%`,
          background: isOver ? '#ef4444' : `linear-gradient(90deg, ${color}88, ${color})`,
          transition: 'width 0.8s ease',
        }} />
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </div>
    </div>
  );
}

/* ===== 進捗リング ===== */
function ProgressRing({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total > 0 ? done / total : 0;
  const r = 40, stroke = 7;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-mono)', color }}>
          {Math.round(pct * 100)}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: -2 }}>%</span>
      </div>
    </div>
  );
}

/* ===== コンテナトラック + 種類分布 ===== */
function ContainerTruckDistribution({ items, completedIds, containerType }: {
  items: ContainerItem[]; completedIds: Set<string>; containerType: string;
}) {
  const types = ['ポリカバー', 'ジャーポット', '箱', '部品', '鍋', 'ヤーマン部品', 'その他'] as const;
  const counts: Record<string, { total: number; done: number }> = {};
  for (const t of types) counts[t] = { total: 0, done: 0 };
  for (const it of items) {
    const key = counts[it.type] ? it.type : 'その他';
    counts[key].total++;
    if (completedIds.has(it.id)) counts[key].done++;
  }
  const total = items.length || 1;

  // コンテナの高さ比率でサイズ調整
  const spec = CONTAINERS[containerType] || CONTAINERS['40HQ'];
  const containerHeight = Math.round(70 * spec.heightRatio);

  // ポリカバーは扉側（右側＝運転席の反対）に配置するため、右から並べる
  // 分布セグメントを扉側（右）からポリカバー→ジャーポット→箱→部品→鍋→その他の順で
  const orderedTypes = types.filter(t => counts[t].total > 0);

  // セグメントの%とラベル位置を計算
  const segments = orderedTypes.map(t => ({
    type: t,
    pct: counts[t].total / total * 100,
    count: counts[t].total,
    done: counts[t].done,
    color: COLOR_MAP[t].accent,
  }));

  return (
    <div>
      {/* コンテナサイズ表示 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 13, fontWeight: 800, color: '#60a5fa',
          textShadow: '0 0 12px rgba(96,165,250,0.3)',
        }}>
          {spec.name}
        </span>
        <span style={{
          fontSize: 9, padding: '2px 8px', borderRadius: 4,
          background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 700,
        }}>推定</span>
      </div>

      {/* トラックSVG（リアルな描写・コンテナ固定・トラック上下） */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg viewBox="0 0 400 160" style={{ width: '100%', height: 'auto' }}>
          <defs>
            <pattern id="done-stripe" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="transparent" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            </pattern>
            <linearGradient id="truck-body" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5a6378" />
              <stop offset="100%" stopColor="#3d4556" />
            </linearGradient>
            <linearGradient id="container-side" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#384058" />
              <stop offset="40%" stopColor="#2d3244" />
              <stop offset="100%" stopColor="#252838" />
            </linearGradient>
            <linearGradient id="road-surface" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2a2d3e" />
              <stop offset="100%" stopColor="#1a1d2e" />
            </linearGradient>
            <linearGradient id="windshield" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(140,180,240,0.45)" />
              <stop offset="100%" stopColor="rgba(80,120,180,0.2)" />
            </linearGradient>
          </defs>

          {/* 道路 */}
          <rect x="0" y="135" width="400" height="25" fill="url(#road-surface)" />
          <line x1="0" y1="147" x2="400" y2="147" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeDasharray="14 10">
            <animate attributeName="stroke-dashoffset" values="0;-24" dur="0.8s" repeatCount="indefinite" />
          </line>
          {/* 路肩線 */}
          <line x1="0" y1="136" x2="400" y2="136" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />

          {/* === トラック部分（キャビン+シャーシ）上下バウンスアニメーション === */}
          <g>
            <animateTransform attributeName="transform" type="translate"
              values="0,0;0,-1.2;0,0;0,-0.5;0,0" dur="1.5s" repeatCount="indefinite" />

            {/* シャーシフレーム */}
            <rect x="28" y="123" width="60" height="6" rx="1" fill="#333840" />
            <rect x="28" y="129" width="60" height="3" rx="1" fill="#2a2e38" />

            {/* キャビン本体 */}
            <rect x="30" y="75" width="56" height="48" rx="5" fill="url(#truck-body)" />
            {/* キャビン側面ディテール */}
            <rect x="30" y="118" width="56" height="6" rx="0" fill="#4a5060" />
            {/* フロントグリル */}
            <rect x="26" y="107" width="4" height="16" rx="1" fill="#444c5a" />
            {Array.from({length: 4}, (_, i) => (
              <line key={`grill-${i}`} x1="27" y1={109 + i * 3} x2="29" y2={109 + i * 3}
                stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
            ))}
            {/* ウインドシールド */}
            <path d="M34,79 L62,79 Q65,79 65,82 L65,95 L34,95 Z" fill="url(#windshield)" />
            {/* ウインドシールドフレーム */}
            <path d="M34,79 L62,79 Q65,79 65,82 L65,95 L34,95 Z" fill="none"
              stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
            {/* ワイパー */}
            <line x1="45" y1="94" x2="55" y2="84" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
            {/* バンパー */}
            <rect x="24" y="121" width="8" height="6" rx="1.5" fill="#555d6a" />
            {/* ヘッドライト */}
            <rect x="25" y="107" width="3" height="4" rx="1" fill="#eab308" opacity="0.7" />
            <rect x="25" y="113" width="3" height="2" rx="0.5" fill="#f59e0b" opacity="0.4" />
            {/* サイドミラー */}
            <rect x="24" y="80" width="5" height="9" rx="1.5" fill="#4a5060" />
            <rect x="24.5" y="81" width="4" height="6" rx="1" fill="rgba(100,140,200,0.2)" />
            {/* ドア */}
            <rect x="46" y="84" width="36" height="34" rx="2" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <circle cx="48" cy="101" r="1" fill="rgba(255,255,255,0.12)" />

            {/* 前輪 */}
            {[46, 68].map((cx, i) => (
              <g key={`fw-${i}`}>
                <circle cx={cx} cy="135" r="11" fill="#1a1c22" stroke="#3a3e48" strokeWidth="2" />
                <circle cx={cx} cy="135" r="7" fill="#2a2e36" stroke="#444" strokeWidth="0.5" />
                <circle cx={cx} cy="135" r="3" fill="#555d68" />
                <g>
                  <animateTransform attributeName="transform" type="rotate"
                    values={`0 ${cx} 135;360 ${cx} 135`} dur="1s" repeatCount="indefinite" />
                  {[0, 60, 120].map((angle) => (
                    <line key={angle}
                      x1={cx + 3.5 * Math.cos(angle * Math.PI / 180)}
                      y1={135 + 3.5 * Math.sin(angle * Math.PI / 180)}
                      x2={cx + 6.5 * Math.cos(angle * Math.PI / 180)}
                      y2={135 + 6.5 * Math.sin(angle * Math.PI / 180)}
                      stroke="#555" strokeWidth="1.2" />
                  ))}
                </g>
              </g>
            ))}
          </g>

          {/* === コンテナ部分（固定） === */}
          <g>
            {/* コンテナ台座 */}
            <rect x="88" y="122" width="275" height="8" rx="1" fill="#333840" />

            {/* コンテナ本体 */}
            <rect x="90" y={130 - 8 - containerHeight}
              width="270" height={containerHeight} rx="2"
              fill="url(#container-side)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {/* コンテナ上面ハイライト */}
            <rect x="90" y={130 - 8 - containerHeight}
              width="270" height="3" rx="2"
              fill="rgba(255,255,255,0.06)" />

            {/* コンテナの縦リブ（波板風） */}
            {Array.from({ length: 18 }, (_, i) => (
              <line key={i}
                x1={90 + 15 * (i + 1)} y1={130 - 8 - containerHeight + 3}
                x2={90 + 15 * (i + 1)} y2={122}
                stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
            ))}

            {/* コンテナ内の種類分布（右=扉側からポリカバー順） */}
            {(() => {
              let x = 90 + 270; // 右端から開始
              const cTop = 130 - 8 - containerHeight + 2;
              const cH = containerHeight - 4;
              return segments.map((seg, i) => {
                const w = (seg.pct / 100) * 268;
                x -= w;
                const showInside = w > 28;
                const donePct = seg.count > 0 ? seg.done / seg.count : 0;
                const doneW = Math.max((w - 1) * donePct, 0);
                const remainW = Math.max(w - 1 - doneW, 0);
                const pctStr = `${seg.pct.toFixed(0)}%`;
                return (
                  <g key={seg.type}>
                    {/* 完了分（暗く表示） */}
                    {doneW > 0 && (
                      <rect x={x + 1} y={cTop}
                        width={doneW} height={cH}
                        fill={seg.color} opacity={0.25}
                        rx={i === 0 ? 2 : 0}
                      />
                    )}
                    {/* 残り分（明るく表示） */}
                    {remainW > 0 && (
                      <rect x={x + 1 + doneW} y={cTop}
                        width={remainW} height={cH}
                        fill={seg.color} opacity={0.8}
                        rx={i === segments.length - 1 ? 2 : 0}
                      />
                    )}
                    {/* 全完了時のストライプ */}
                    {seg.done === seg.count && seg.count > 0 && (
                      <rect x={x + 1} y={cTop}
                        width={Math.max(w - 1, 1)} height={cH}
                        fill="url(#done-stripe)" opacity={0.3}
                        rx={i === 0 ? 2 : i === segments.length - 1 ? 2 : 0}
                      />
                    )}
                    {showInside ? (
                      <text x={x + w / 2} y={cTop + cH / 2 + 1}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="10" fontWeight="800" fill="#fff"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                        {pctStr}
                      </text>
                    ) : (
                      <g>
                        <line x1={x + w / 2} y1={cTop - 2}
                          x2={x + w / 2} y2={cTop - 14}
                          stroke={seg.color} strokeWidth="1" opacity="0.7" />
                        <text x={x + w / 2} y={cTop - 17}
                          textAnchor="middle" fontSize="8" fontWeight="700" fill={seg.color}>
                          {pctStr}
                        </text>
                      </g>
                    )}
                  </g>
                );
              });
            })()}

            {/* コンテナ扉（右端・観音開き） */}
            <line x1={360} y1={130 - 8 - containerHeight + 3}
              x2={360} y2={121} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            <line x1={357} y1={130 - 8 - containerHeight + 3}
              x2={357} y2={121} stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
            {/* 扉ハンドル */}
            <rect x="358" y={130 - 8 - containerHeight / 2 - 4} width="2" height="8" rx="0.5" fill="rgba(255,255,255,0.15)" />
            <rect x="354" y={130 - 8 - containerHeight / 2 - 4} width="2" height="8" rx="0.5" fill="rgba(255,255,255,0.1)" />

            {/* ロッキングバー */}
            <rect x="361" y={130 - 8 - containerHeight + 6} width="1.5" height={containerHeight - 14} rx="0.5"
              fill="rgba(255,255,255,0.08)" />

            {/* 後輪（コンテナ下、固定） */}
            {[300, 322, 345].map((cx, i) => (
              <g key={`rw-${i}`}>
                <circle cx={cx} cy="135" r="11" fill="#1a1c22" stroke="#3a3e48" strokeWidth="2" />
                <circle cx={cx} cy="135" r="7" fill="#2a2e36" stroke="#444" strokeWidth="0.5" />
                <circle cx={cx} cy="135" r="3" fill="#555d68" />
                <g>
                  <animateTransform attributeName="transform" type="rotate"
                    values={`0 ${cx} 135;360 ${cx} 135`} dur="1s" repeatCount="indefinite" />
                  {[0, 60, 120].map((angle) => (
                    <line key={angle}
                      x1={cx + 3.5 * Math.cos(angle * Math.PI / 180)}
                      y1={135 + 3.5 * Math.sin(angle * Math.PI / 180)}
                      x2={cx + 6.5 * Math.cos(angle * Math.PI / 180)}
                      y2={135 + 6.5 * Math.sin(angle * Math.PI / 180)}
                      stroke="#555" strokeWidth="1.2" />
                  ))}
                </g>
              </g>
            ))}
          </g>
        </svg>

        {/* 扉ラベル */}
        <div style={{
          position: 'absolute', right: 12, top: 6,
          fontSize: 8, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.5px',
        }}>
          DOOR →
        </div>
      </div>

      {/* 種類別 完了/残り 詳細バー */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {orderedTypes.map((t) => {
          const c = COLOR_MAP[t];
          const { total: typeTotal, done: typeDone } = counts[t];
          const typeRemain = typeTotal - typeDone;
          const donePct = typeTotal > 0 ? (typeDone / typeTotal) * 100 : 0;
          const allDone = typeDone === typeTotal && typeTotal > 0;
          return (
            <div key={t} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: allDone ? 0.45 : 1,
            }}>
              {/* ラベル */}
              <div style={{
                width: 80, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c.accent, flexShrink: 0 }} />
                <span style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{t}</span>
              </div>
              {/* 進捗バー */}
              <div style={{
                flex: 1, height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.04)',
                overflow: 'hidden', position: 'relative',
              }}>
                {/* 完了分（暗め） */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${donePct}%`,
                  background: c.accent, opacity: 0.3,
                  transition: 'width 0.5s ease',
                }} />
                {/* 完了ストライプ */}
                {allDone && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 6px)`,
                  }} />
                )}
                {/* 残りカウント表示 */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: allDone ? 'rgba(255,255,255,0.5)' : '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                }}>
                  {allDone ? '完了' : `残 ${typeRemain}`}
                </div>
              </div>
              {/* 数値 */}
              <div style={{
                width: 52, textAlign: 'right', flexShrink: 0,
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 800, color: c.accent,
              }}>
                <span style={{ opacity: 0.5 }}>{typeDone}</span>
                <span style={{ opacity: 0.3 }}>/</span>
                {typeTotal}
              </div>
            </div>
          );
        })}
        {/* 合計行 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginTop: 2,
        }}>
          <div style={{ width: 80, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, paddingLeft: 12 }}>
            合計
          </div>
          <div style={{
            flex: 1, height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.04)',
            overflow: 'hidden', position: 'relative',
          }}>
            {(() => {
              const totalAll = items.length || 1;
              const doneAll = items.filter(it => completedIds.has(it.id)).length;
              const pctAll = (doneAll / totalAll) * 100;
              return (
                <>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pctAll}%`,
                    background: '#22c55e', opacity: 0.4,
                    transition: 'width 0.5s ease',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}>
                    {doneAll === totalAll ? '全完了' : `残 ${totalAll - doneAll} (${Math.round(pctAll)}%)`}
                  </div>
                </>
              );
            })()}
          </div>
          <div style={{
            width: 52, textAlign: 'right', flexShrink: 0,
            fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#22c55e',
          }}>
            <span style={{ opacity: 0.5 }}>{items.filter(it => completedIds.has(it.id)).length}</span>
            <span style={{ opacity: 0.3 }}>/</span>
            {items.length}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== サマリカード ===== */
function SummaryCard({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  return (
    <div style={{
      background: `${color}0a`, border: `1px solid ${color}20`,
      borderRadius: 12, padding: '12px 14px',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-mono)', color,
          textShadow: `0 0 16px ${color}30`,
        }}>{value}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
      </div>
    </div>
  );
}

/* ===== メイン ===== */
export default function ContainerAnalyticsPage({
  items, completedIds, containerNo,
}: ContainerAnalyticsPageProps) {
  const activeItems = items.filter((it) => !completedIds.has(it.id));
  const doneItems = items.filter((it) => completedIds.has(it.id));

  // アイテムのCBM取得（cbmフィールド優先、なければmeasurements(cm)から計算）
  const getItemCbm = (it: ContainerItem): number => {
    if (it.cbm && it.cbm > 0) return it.cbm;
    // measurements は cm 単位 (例: "55*38*38") → m³ に変換
    if (it.measurements) {
      const dims = parseMeas(it.measurements);
      if (dims) return (dims[0] * dims[1] * dims[2]) / 1000000;
    }
    return 0;
  };

  // CBM / 重量集計
  let totalCbm = 0, totalWeight = 0, hasCbm = false;
  for (const it of items) {
    const cbm = getItemCbm(it);
    if (cbm > 0) { totalCbm += cbm * (it.caseCount || 1); hasCbm = true; }
    if (it.grossWeight) totalWeight += it.grossWeight * (it.caseCount || 1);
  }
  let doneCbm = 0, doneWeight = 0;
  for (const it of doneItems) {
    const cbm = getItemCbm(it);
    if (cbm > 0) doneCbm += cbm * (it.caseCount || 1);
    if (it.grossWeight) doneWeight += it.grossWeight * (it.caseCount || 1);
  }
  const remainCbm = totalCbm - doneCbm;
  const remainWeight = totalWeight - doneWeight;

  // 寸法分布
  const sizeItems = items.filter((it) => it.measurements && parseMeas(it.measurements));

  // コンテナタイプ自動推定
  const bestContainer = totalCbm <= 33 ? '20FT' : totalCbm <= 67 ? '40FT' : '40HQ';
  const bestSpec = CONTAINERS[bestContainer];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#141720', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: '14px 16px', background: '#1a1d2e',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
            コンテナ分析
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
            {containerNo}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* === 進捗状況 === */}
        <div style={{
          background: '#1e2130', borderRadius: 14, padding: 16,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
            進捗状況
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ProgressRing done={doneItems.length} total={items.length} color="#22c55e" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>完了</div>
                  <AnimatedNumber value={doneItems.length} color="#22c55e" size={32} delay={100} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>残り</div>
                  <AnimatedNumber value={activeItems.length} color="#f59e0b" size={32} delay={200} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>合計</div>
                  <AnimatedNumber value={items.length} color="rgba(255,255,255,0.7)" size={32} delay={300} />
                </div>
              </div>
              {hasCbm && (
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    完了CBM: <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{doneCbm.toFixed(1)}</span>
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    残CBM: <span style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{remainCbm.toFixed(1)}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === 種類分布（コンテナトラック） === */}
        <div style={{
          background: '#1e2130', borderRadius: 14, padding: 16,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            種類分布
          </div>
          <ContainerTruckDistribution items={items} completedIds={completedIds} containerType={bestContainer} />
        </div>

        {/* === コンテナ積載率（推定サイズのみ） === */}
        {hasCbm && (
          <div style={{
            background: '#1e2130', borderRadius: 14, padding: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                コンテナ積載率
              </span>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#60a5fa',
                fontFamily: 'var(--font-mono)',
              }}>
                {bestSpec.name}
              </span>
            </div>
            <ProgressBar
              value={totalCbm} max={bestSpec.cbm}
              color="#3b82f6"
              label="容積 (CBM)"
              subLabel="m³"
            />
            {totalWeight > 0 && (
              <ProgressBar
                value={totalWeight / 1000} max={bestSpec.maxKg / 1000}
                color="#8b5cf6"
                label="重量"
                subLabel="t"
              />
            )}
            {/* 大きな積載率表示 */}
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 4,
              padding: '10px 0 4px',
            }}>
              <span style={{
                fontSize: 40, fontWeight: 900, fontFamily: 'var(--font-mono)',
                color: totalCbm / bestSpec.cbm > 1 ? '#ef4444' : '#3b82f6',
                textShadow: `0 0 24px ${totalCbm / bestSpec.cbm > 1 ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
              }}>
                {Math.min(totalCbm / bestSpec.cbm * 100, 999).toFixed(1)}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>%</span>
            </div>
          </div>
        )}

        {/* === 全体サマリ === */}
        <div style={{
          background: '#1e2130', borderRadius: 14, padding: 16,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
            全体サマリ
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            <SummaryCard label="合計 CBM" value={totalCbm.toFixed(2)} unit="m³" color="#3b82f6" />
            <SummaryCard label="合計 重量" value={(totalWeight / 1000).toFixed(2)} unit="t" color="#8b5cf6" />
            <SummaryCard label="残 CBM" value={remainCbm.toFixed(2)} unit="m³" color="#f59e0b" />
            <SummaryCard label="残 重量" value={(remainWeight / 1000).toFixed(2)} unit="t" color="#f97316" />
            <SummaryCard label="品目数" value={String(items.length)} unit="品" color="#22c55e" />
            <SummaryCard label="寸法あり" value={String(sizeItems.length)} unit={`/ ${items.length}`} color="#6b7280" />
          </div>
        </div>

        {/* === 品目別CBMランキング === */}
        {hasCbm && (
          <div style={{
            background: '#1e2130', borderRadius: 14, padding: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              品目別 CBM (降順)
            </div>
            {[...items]
              .filter((it) => getItemCbm(it) > 0)
              .sort((a, b) => (getItemCbm(b) * (b.caseCount || 1)) - (getItemCbm(a) * (a.caseCount || 1)))
              .slice(0, 10)
              .map((it) => {
                const c = COLOR_MAP[it.type] || COLOR_MAP['その他'];
                const itemCbm = getItemCbm(it) * (it.caseCount || 1);
                const isDone = completedIds.has(it.id);
                const name = it.itemName.replace(/ポリカバー/g, '').trim() || it.itemName;
                return (
                  <div key={it.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    opacity: isDone ? 0.4 : 1,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.accent, flexShrink: 0 }} />
                    <span style={{
                      flex: 1, fontSize: 12, color: isDone ? '#666' : 'rgba(255,255,255,0.8)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{name}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 800, color: c.accent }}>
                      {itemCbm.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>m³</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

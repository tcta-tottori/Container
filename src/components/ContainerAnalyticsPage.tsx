'use client';

import { useEffect, useRef, useState } from 'react';
import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { getNabeModelColor } from '@/lib/nabeColors';
import { itemCbm } from '@/lib/containerLoad';
import ContainerLoadFigure, { buildLoadFigureData, LoadFigureData } from './ContainerLoadFigure';
import ContainerLoadFullscreen from './ContainerLoadFullscreen';

interface ContainerAnalyticsPageProps {
  items: ContainerItem[];
  completedIds: Set<string>;
  containerNo: string;
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
function ContainerTruckDistribution({ items, completedIds, data, onOpen }: {
  items: ContainerItem[];
  completedIds: Set<string>;
  data: LoadFigureData;
  onOpen: () => void;
}) {
  const types = ['ポリカバー', 'ジャーポット', '箱', '部品', '鍋', 'ヤーマン部品', 'その他'] as const;
  const counts: Record<string, { total: number; done: number }> = {};
  for (const t of types) counts[t] = { total: 0, done: 0 };
  for (const it of items) {
    const key = counts[it.type] ? it.type : 'その他';
    counts[key].total++;
    if (completedIds.has(it.id)) counts[key].done++;
  }
  const orderedTypes = types.filter(t => counts[t].total > 0);

  return (
    <div>
      {/* 立体のトラック図（タップで全画面） */}
      <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
        style={{ cursor: 'pointer', position: 'relative', outline: 'none' }}
      >
        <ContainerLoadFigure
          items={items}
          completedIds={completedIds}
          data={data}
          compact
          showLegend={false}
          showDims={false}
          intro
        />
        <div style={{
          position: 'absolute', right: 0, bottom: 2,
          fontSize: 10, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
        }}>
          タップで全画面・回転
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
  const [fullscreen, setFullscreen] = useState(false);

  // 積載量は共通の決まり（containerLoad）で出す。
  // Meas.（1ケースの外寸 cm）から1ケースの体積を出し、ケース数を掛ける。
  const figure = buildLoadFigureData(items, completedIds);
  const {
    totalCbm, doneCbm, remainCbm, totalKg, remainKg, hasCbm, sizedCount, spec: bestSpec,
  } = figure.summary;
  const totalWeight = totalKg;
  const remainWeight = remainKg;

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
          <ContainerTruckDistribution
            items={items}
            completedIds={completedIds}
            data={figure}
            onOpen={() => setFullscreen(true)}
          />
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
            <SummaryCard label="寸法あり" value={String(sizedCount)} unit={`/ ${items.length}`} color="#6b7280" />
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
              .filter((it) => itemCbm(it) > 0)
              .sort((a, b) => itemCbm(b) - itemCbm(a))
              .slice(0, 10)
              .map((it) => {
                const c = COLOR_MAP[it.type] || COLOR_MAP['その他'];
                const nabeColor = getNabeModelColor(it.itemName, it.type);
                const dotColor = nabeColor || c.accent;
                const lineCbm = itemCbm(it);
                const isDone = completedIds.has(it.id);
                const name = it.itemName.replace(/ポリカバー/g, '').trim() || it.itemName;
                return (
                  <div key={it.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    opacity: isDone ? 0.4 : 1,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    <span style={{
                      flex: 1, fontSize: 12, color: isDone ? '#666' : (nabeColor || 'rgba(255,255,255,0.8)'),
                      textDecoration: isDone ? 'line-through' : 'none',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{name}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 800, color: dotColor }}>
                      {lineCbm.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>m³</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 積載状況の全画面表示（回転できる立体図） */}
      {fullscreen && (
        <ContainerLoadFullscreen
          items={items}
          completedIds={completedIds}
          containerNo={containerNo}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}

'use client';

import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface ContainerAnalyticsPageProps {
  items: ContainerItem[];
  completedIds: Set<string>;
  containerNo: string;
}

/* ===== コンテナスペック ===== */
const CONTAINERS: Record<string, { name: string; cbm: number; maxKg: number; innerL: number; innerW: number; innerH: number }> = {
  '20FT': { name: "20' DRY", cbm: 33.2, maxKg: 21770, innerL: 590, innerW: 235, innerH: 239 },
  '40FT': { name: "40' DRY", cbm: 67.7, maxKg: 26680, innerL: 1203, innerW: 235, innerH: 239 },
  '40HQ': { name: "40' HIGH CUBE", cbm: 76.3, maxKg: 26460, innerL: 1203, innerW: 235, innerH: 269 },
};

/* ===== 寸法パース ===== */
function parseMeas(meas: string): [number, number, number] | null {
  const m = meas.match(/(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/* ===== プログレスバー ===== */
function ProgressBar({ value, max, color, label, subLabel }: {
  value: number; max: number; color: string; label: string; subLabel?: string;
}) {
  const pct = max > 0 ? Math.min(value / max * 100, 100) : 0;
  const isOver = value > max;
  return (
    <div style={{ marginBottom: 12 }}>
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
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </div>
    </div>
  );
}

/* ===== 種類分布バー ===== */
function TypeDistribution({ items, completedIds }: { items: ContainerItem[]; completedIds: Set<string> }) {
  const types = ['ポリカバー', '箱', '部品', '鍋', 'その他'] as const;
  const counts: Record<string, { total: number; done: number }> = {};
  for (const t of types) counts[t] = { total: 0, done: 0 };
  for (const it of items) {
    const key = counts[it.type] ? it.type : 'その他';
    counts[key].total++;
    if (completedIds.has(it.id)) counts[key].done++;
  }
  const total = items.length || 1;

  return (
    <div>
      {/* 積み上げバー */}
      <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
        {types.map((t) => {
          const c = COLOR_MAP[t];
          const pct = counts[t].total / total * 100;
          if (pct === 0) return null;
          return (
            <div key={t} style={{
              width: `${pct}%`, background: c.accent, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#fff', overflow: 'hidden',
              transition: 'width 0.4s ease',
            }}>
              {pct > 8 && `${counts[t].total}`}
            </div>
          );
        })}
      </div>
      {/* 凡例 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {types.map((t) => {
          const c = COLOR_MAP[t];
          if (counts[t].total === 0) return null;
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.accent }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{t}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: c.accent }}>
                {counts[t].done}/{counts[t].total}
              </span>
            </div>
          );
        })}
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
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
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

/* ===== メイン ===== */
export default function ContainerAnalyticsPage({
  items, completedIds, containerNo,
}: ContainerAnalyticsPageProps) {
  const activeItems = items.filter((it) => !completedIds.has(it.id));
  const doneItems = items.filter((it) => completedIds.has(it.id));

  // CBM / 重量集計
  let totalCbm = 0, totalWeight = 0, hasCbm = false;
  for (const it of items) {
    if (it.cbm) { totalCbm += it.cbm * (it.caseCount || 1); hasCbm = true; }
    if (it.grossWeight) totalWeight += it.grossWeight * (it.caseCount || 1);
  }
  let doneCbm = 0, doneWeight = 0;
  for (const it of doneItems) {
    if (it.cbm) doneCbm += it.cbm * (it.caseCount || 1);
    if (it.grossWeight) doneWeight += it.grossWeight * (it.caseCount || 1);
  }
  const remainCbm = totalCbm - doneCbm;
  const remainWeight = totalWeight - doneWeight;

  // 寸法分布
  const sizeItems = items.filter((it) => it.measurements && parseMeas(it.measurements));

  // コンテナタイプ自動推定
  const bestContainer = totalCbm <= 33 ? '20FT' : totalCbm <= 67 ? '40FT' : '40HQ';

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
            📊 コンテナ分析
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
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
            進捗状況
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ProgressRing done={doneItems.length} total={items.length} color="#22c55e" />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>完了</div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>
                    {doneItems.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>残り</div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
                    {activeItems.length}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>合計</div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>
                    {items.length}
                  </div>
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

        {/* === 種類分布 === */}
        <div style={{
          background: '#1e2130', borderRadius: 14, padding: 16,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
            種類分布
          </div>
          <TypeDistribution items={items} completedIds={completedIds} />
        </div>

        {/* === コンテナ積載率 === */}
        {hasCbm && (
          <div style={{
            background: '#1e2130', borderRadius: 14, padding: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              コンテナ積載率
            </div>
            {Object.entries(CONTAINERS).map(([key, spec]) => {
              const isBest = key === bestContainer;
              return (
                <div key={key} style={{
                  marginBottom: 14, padding: isBest ? '10px 12px' : 0,
                  borderRadius: isBest ? 10 : 0,
                  background: isBest ? 'rgba(59,130,246,0.08)' : 'transparent',
                  border: isBest ? '1px solid rgba(59,130,246,0.2)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isBest ? '#60a5fa' : 'rgba(255,255,255,0.6)' }}>
                      {spec.name}
                    </span>
                    {isBest && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontWeight: 700,
                      }}>推定</span>
                    )}
                  </div>
                  <ProgressBar
                    value={totalCbm} max={spec.cbm}
                    color={isBest ? '#3b82f6' : '#6b7280'}
                    label="容積 (CBM)"
                    subLabel="m³"
                  />
                  {totalWeight > 0 && (
                    <ProgressBar
                      value={totalWeight / 1000} max={spec.maxKg / 1000}
                      color={isBest ? '#8b5cf6' : '#6b7280'}
                      label="重量"
                      subLabel="t"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* === CBM/重量サマリ === */}
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
              .filter((it) => it.cbm && it.cbm > 0)
              .sort((a, b) => ((b.cbm || 0) * (b.caseCount || 1)) - ((a.cbm || 0) * (a.caseCount || 1)))
              .slice(0, 10)
              .map((it) => {
                const c = COLOR_MAP[it.type] || COLOR_MAP['その他'];
                const itemCbm = (it.cbm || 0) * (it.caseCount || 1);
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
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: c.accent }}>
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

/* ===== サマリカード ===== */
function SummaryCard({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  return (
    <div style={{
      background: `${color}08`, border: `1px solid ${color}20`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-mono)', color }}>{value}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
      </div>
    </div>
  );
}

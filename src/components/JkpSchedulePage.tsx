'use client';

import { useState, useMemo } from 'react';
import { JkpShipment, filterShipmentsByDateRange } from '@/lib/jkpParser';

interface JkpSchedulePageProps {
  shipments: JkpShipment[];
  /** 品目一覧との紐付用コールバック */
  onSelectShipment?: (partNumber: string, itemName: string) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  return dateStr === fmtDate(today);
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

/** 出荷日ごとにグループ化 */
function groupByDate(
  shipments: JkpShipment[],
  startDate: string,
  endDate: string,
): Map<string, { partNumber: string; itemName: string; qty: number | string }[]> {
  const groups = new Map<string, { partNumber: string; itemName: string; qty: number | string }[]>();

  // 日付リストを先に作成
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const d = new Date(start);
  while (d <= end) {
    groups.set(fmtDate(d), []);
    d.setDate(d.getDate() + 1);
  }

  for (const s of shipments) {
    s.schedule.forEach((val, date) => {
      if (date >= startDate && date <= endDate && val) {
        const items = groups.get(date) || [];
        items.push({
          partNumber: s.partNumber,
          itemName: s.itemName,
          qty: val,
        });
        groups.set(date, items);
      }
    });
  }

  return groups;
}

export default function JkpSchedulePage({ shipments, onSelectShipment }: JkpSchedulePageProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewType, setViewType] = useState<'date' | 'table'>('date');
  const [startDate, setStartDate] = useState(fmtDate(today));
  const [endDate, setEndDate] = useState(fmtDate(addDays(today, 14)));
  const [sizeFilter, setSizeFilter] = useState<'all' | '100' | '180'>('all');

  // プリセットボタン
  const presets = [
    { label: '今日', start: fmtDate(today), end: fmtDate(today) },
    { label: '今週', start: fmtDate(today), end: fmtDate(addDays(today, 6 - today.getDay())) },
    { label: '2週間', start: fmtDate(today), end: fmtDate(addDays(today, 14)) },
    { label: '1ヶ月', start: fmtDate(today), end: fmtDate(addDays(today, 30)) },
  ];

  // 日付グループ化データ
  const dateGroups = useMemo(() => {
    let filtered = shipments;
    if (sizeFilter !== 'all') {
      filtered = shipments.filter(s => s.itemName.includes(sizeFilter));
    }
    return groupByDate(filtered, startDate, endDate);
  }, [shipments, startDate, endDate, sizeFilter]);

  // テーブル用データ
  const filteredTable = useMemo(() => {
    let data = filterShipmentsByDateRange(shipments, startDate, endDate);
    if (sizeFilter !== 'all') {
      data = data.filter(d => d.itemName.includes(sizeFilter));
    }
    return data;
  }, [shipments, startDate, endDate, sizeFilter]);

  // 日付範囲の日付リスト（テーブル用）
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const d = new Date(start);
    while (d <= end) {
      dates.push(fmtDate(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  if (shipments.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)' }}>
        <span style={{ fontSize: 40, marginBottom: 12 }}>🍲</span>
        <p style={{ fontSize: 14, fontWeight: 600 }}>JKPファイルが読み込まれていません</p>
        <p style={{ fontSize: 11 }}>JKP_Shipping_Schedule.xlsx をドロップしてください</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#141720', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: '12px 16px', background: '#1a1d2e',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>鍋 出荷予定</span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700,
          }}>JKP</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button onClick={() => setViewType('date')}
              style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700,
                background: viewType === 'date' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                color: viewType === 'date' ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              }}>日付別</button>
            <button onClick={() => setViewType('table')}
              style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700,
                background: viewType === 'table' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                color: viewType === 'table' ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              }}>一覧表</button>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div style={{ padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => { setStartDate(p.start); setEndDate(p.end); }}
              style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontWeight: 700,
                background: startDate === p.start && endDate === p.end ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                color: startDate === p.start && endDate === p.end ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              }}>
              {p.label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['all', '100', '180'] as const).map(s => (
              <button key={s} onClick={() => setSizeFilter(s)}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontWeight: 700,
                  background: sizeFilter === s ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.06)',
                  color: sizeFilter === s ? '#eab308' : 'rgba(255,255,255,0.4)',
                }}>
                {s === 'all' ? '全て' : s}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{
              fontSize: 11, padding: '4px 8px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              color: '#fff', outline: 'none',
            }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>〜</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{
              fontSize: 11, padding: '4px 8px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              color: '#fff', outline: 'none',
            }} />
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: viewType === 'table' ? 'auto' : 'hidden', padding: '0 0 16px' }}>
        {viewType === 'date' ? (
          /* ===== 日付別カードビュー ===== */
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from(dateGroups.entries()).map(([date, items]) => {
              if (items.length === 0) return null;
              const todayFlag = isToday(date);
              const weekend = isWeekend(date);
              const dayOfWeek = new Date(date + 'T00:00:00').getDay();
              const totalQty = items.reduce((s, it) => s + (typeof it.qty === 'number' ? it.qty : 0), 0);

              return (
                <div key={date} style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: todayFlag ? '1.5px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  background: todayFlag ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)',
                }}>
                  {/* 日付ヘッダー */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: todayFlag ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: 800,
                      color: todayFlag ? '#60a5fa' : dayOfWeek === 0 ? '#ef4444' : dayOfWeek === 6 ? '#3b82f6' : '#fff',
                    }}>
                      {dateLabel(date)}
                    </span>
                    {todayFlag && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(59,130,246,0.3)', color: '#60a5fa', fontWeight: 700,
                      }}>TODAY</span>
                    )}
                    {weekend && !todayFlag && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: dayOfWeek === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                        color: dayOfWeek === 0 ? '#ef4444' : '#3b82f6', fontWeight: 600,
                      }}>{dayOfWeek === 0 ? '日' : '土'}</span>
                    )}
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600,
                    }}>
                      {items.length}品目
                    </span>
                    {totalQty > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: '#22c55e', fontFamily: 'var(--font-mono)',
                      }}>
                        {totalQty.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* 品目リスト */}
                  <div style={{ padding: '4px 0' }}>
                    {items.map((it, i) => (
                      <div key={it.partNumber + i}
                        onClick={() => onSelectShipment?.(it.partNumber, it.itemName)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 12px',
                          cursor: onSelectShipment ? 'pointer' : 'default',
                          borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                        }}
                      >
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: '#fff', flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {it.itemName}
                        </span>
                        <span style={{
                          fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)',
                        }}>
                          {it.partNumber}
                        </span>
                        <span style={{
                          fontSize: 12, fontWeight: 800, color: typeof it.qty === 'number' ? '#f59e0b' : '#a78bfa',
                          fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right',
                        }}>
                          {typeof it.qty === 'number' ? it.qty.toLocaleString() : it.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {Array.from(dateGroups.values()).every(items => items.length === 0) && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                選択期間内に出荷予定はありません
              </div>
            )}
          </div>
        ) : (
          /* ===== テーブルビュー ===== */
          filteredTable.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              選択期間内に出荷予定はありません
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <th style={{
                    ...thStyle, position: 'sticky', left: 0, zIndex: 3, minWidth: 80,
                    background: '#1e2130',
                  }}>品番</th>
                  <th style={{
                    ...thStyle, position: 'sticky', left: 80, zIndex: 3, minWidth: 100,
                    background: '#1e2130',
                  }}>品名</th>
                  {dateRange.map(d => (
                    <th key={d} style={{
                      ...thStyle, minWidth: 45, background: '#1e2130',
                      color: new Date(d + 'T00:00:00').getDay() === 0 ? '#ef4444' :
                             new Date(d + 'T00:00:00').getDay() === 6 ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                    }}>
                      {dateLabel(d)}
                    </th>
                  ))}
                  <th style={{ ...thStyle, minWidth: 55, background: '#1e2130', color: '#22c55e' }}>合計</th>
                </tr>
              </thead>
              <tbody>
                {filteredTable.map((row, i) => (
                  <tr key={row.partNumber + i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <td style={{
                      ...tdStyle, position: 'sticky', left: 0, background: '#141720',
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                    }}>{row.partNumber}</td>
                    <td style={{
                      ...tdStyle, position: 'sticky', left: 80, background: '#141720',
                      fontWeight: 600, color: '#fff',
                    }}>{row.itemName}</td>
                    {dateRange.map(d => {
                      const val = row.dailyQty.get(d);
                      const isNum = typeof val === 'number';
                      return (
                        <td key={d} style={{
                          ...tdStyle, textAlign: 'center',
                          color: isNum ? '#fff' : '#f59e0b',
                          fontWeight: isNum && val > 0 ? 700 : 400,
                          background: isNum && val > 0 ? 'rgba(34,197,94,0.06)' : 'transparent',
                        }}
                          title={typeof val === 'string' ? val : undefined}
                        >
                          {val === undefined ? '—' :
                           typeof val === 'number' ? val.toLocaleString() :
                           val}
                        </td>
                      );
                    })}
                    <td style={{
                      ...tdStyle, textAlign: 'center', fontWeight: 900, fontFamily: 'var(--font-mono)',
                      color: '#22c55e', fontSize: 12,
                    }}>
                      {row.total > 0 ? row.total.toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* サマリ */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
        background: '#1a1d2e', flexShrink: 0,
        display: 'flex', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.5)',
      }}>
        <span>品目: <b style={{ color: '#fff' }}>{filteredTable.length}</b></span>
        <span>合計: <b style={{ color: '#22c55e' }}>{filteredTable.reduce((s, r) => s + r.total, 0).toLocaleString()}</b></span>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap',
};

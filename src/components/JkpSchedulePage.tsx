'use client';

import { useState, useMemo } from 'react';
import { JkpShipment, filterShipmentsByDateRange } from '@/lib/jkpParser';

interface JkpSchedulePageProps {
  shipments: JkpShipment[];
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

export default function JkpSchedulePage({ shipments }: JkpSchedulePageProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [startDate, setStartDate] = useState(fmtDate(today));
  const [endDate, setEndDate] = useState(fmtDate(addDays(today, 14)));
  const [sizeFilter, setSizeFilter] = useState<'all' | '100' | '180'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'total'>('total');

  // プリセットボタン
  const presets = [
    { label: '今日のみ', start: fmtDate(today), end: fmtDate(today) },
    { label: '今週', start: fmtDate(today), end: fmtDate(addDays(today, 6 - today.getDay())) },
    { label: '2週間', start: fmtDate(today), end: fmtDate(addDays(today, 14)) },
    { label: '1ヶ月', start: fmtDate(today), end: fmtDate(addDays(today, 30)) },
  ];

  // 日付範囲内の日付リスト
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

  // フィルタ済みデータ
  const filtered = useMemo(() => {
    let data = filterShipmentsByDateRange(shipments, startDate, endDate);

    // サイズフィルター
    if (sizeFilter !== 'all') {
      data = data.filter(d => d.itemName.includes(sizeFilter));
    }

    // ソート
    if (sortBy === 'name') {
      data.sort((a, b) => a.itemName.localeCompare(b.itemName));
    }
    // total はデフォルト降順

    return data;
  }, [shipments, startDate, endDate, sizeFilter, sortBy]);

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
        </div>
      </div>

      {/* 日付セレクター */}
      <div style={{ padding: '10px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
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
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['all', '100', '180'] as const).map(s => (
              <button key={s} onClick={() => setSizeFilter(s)}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontWeight: 700,
                  background: sizeFilter === s ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.06)',
                  color: sizeFilter === s ? '#eab308' : 'rgba(255,255,255,0.4)',
                }}>
                {s === 'all' ? '全サイズ' : s}
              </button>
            ))}
          </div>
          <button onClick={() => setSortBy(sortBy === 'total' ? 'name' : 'total')}
            style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontWeight: 600,
            }}>
            {sortBy === 'total' ? '数量順' : '品名順'}
          </button>
        </div>
      </div>

      {/* テーブル */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '0 0 16px' }}>
        {filtered.length === 0 ? (
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
              {filtered.map((row, i) => (
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
                         '📝'}
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
        )}
      </div>

      {/* サマリ */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
        background: '#1a1d2e', flexShrink: 0,
        display: 'flex', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.5)',
      }}>
        <span>品目: <b style={{ color: '#fff' }}>{filtered.length}</b></span>
        <span>合計: <b style={{ color: '#22c55e' }}>{filtered.reduce((s, r) => s + r.total, 0).toLocaleString()}</b></span>
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

'use client';

import { useMemo, useState } from 'react';
import { ShipmentRecord } from '@/lib/shipmentScheduleParser';

interface ShipmentSchedulePageProps {
  records: ShipmentRecord[];
  rangeStart: string;
  rangeEnd: string;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function dateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const t = new Date();
  const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return iso === dateStr;
}

export default function ShipmentSchedulePage({ records, rangeStart, rangeEnd }: ShipmentSchedulePageProps) {
  const [viewType, setViewType] = useState<'date' | 'table'>('date');
  const [vesselFilter, setVesselFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');

  // 船便名のユニーク一覧
  const vesselOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) if (r.vesselName) set.add(r.vesselName);
    return Array.from(set).sort();
  }, [records]);

  // フィルタ適用
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return records.filter(r => {
      if (vesselFilter !== 'all' && r.vesselName !== vesselFilter) return false;
      if (k) {
        const hay = `${r.refNo} ${r.partNumber} ${r.newPartNumber} ${r.itemName} ${r.orderNo} ${r.delivery}`.toLowerCase();
        if (!hay.includes(k)) return false;
      }
      return true;
    });
  }, [records, vesselFilter, keyword]);

  // 入港日でグループ化
  const groupedByArrival = useMemo(() => {
    const map = new Map<string, ShipmentRecord[]>();
    for (const r of filtered) {
      const k = r.arrivalDate || '(未設定)';
      const list = map.get(k) || [];
      list.push(r);
      map.set(k, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const totalQty = useMemo(() => filtered.reduce((s, r) => s + (r.qty || 0), 0), [filtered]);

  if (records.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)' }}>
        <span style={{ fontSize: 40, marginBottom: 12 }}>🚢</span>
        <p style={{ fontSize: 14, fontWeight: 600 }}>船便出荷予定明細が読み込まれていません</p>
        <p style={{ fontSize: 11 }}>「気高出货予定.xlsx」をドロップしてください</p>
        <p style={{ fontSize: 10, marginTop: 6, color: 'rgba(255,255,255,0.3)' }}>
          入港日（Q列）が当日の3週間前〜当日のレコードを表示します
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#141720', overflow: 'hidden',
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: '12px 16px', background: '#1a1d2e',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>船便出荷予定明細</span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontWeight: 700,
          }}>船便</span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}>
            入港日 {rangeStart} 〜 {rangeEnd}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button onClick={() => setViewType('date')}
              style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700,
                background: viewType === 'date' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                color: viewType === 'date' ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              }}>入港日別</button>
            <button onClick={() => setViewType('table')}
              style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700,
                background: viewType === 'table' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                color: viewType === 'table' ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              }}>一覧表</button>
          </div>
        </div>
      </div>

      {/* フィルタ */}
      <div style={{
        padding: '8px 16px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <select value={vesselFilter} onChange={e => setVesselFilter(e.target.value)}
          style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
            color: '#fff', outline: 'none',
          }}>
          <option value="all" style={{ background: '#1e2235' }}>船便: 全て ({vesselOptions.length})</option>
          {vesselOptions.map(v => (
            <option key={v} value={v} style={{ background: '#1e2235' }}>{v}</option>
          ))}
        </select>
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="REF/品番/品名で検索..."
          style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
            color: '#fff', outline: 'none', minWidth: 200,
          }} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          <b style={{ color: '#fff' }}>{filtered.length}</b> 件 / 数量合計 <b style={{ color: '#22c55e' }}>{totalQty.toLocaleString()}</b>
        </span>
      </div>

      {/* コンテンツ */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 0 16px' }}>
        {viewType === 'date' ? (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {groupedByArrival.map(([date, items]) => {
              const todayFlag = isToday(date);
              const dayOfWeek = date && date !== '(未設定)' ? new Date(date + 'T00:00:00').getDay() : -1;
              const groupQty = items.reduce((s, it) => s + (it.qty || 0), 0);

              return (
                <div key={date} style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: todayFlag ? '1.5px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  background: todayFlag ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)',
                }}>
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
                      入港 {dateLabel(date)}
                    </span>
                    {todayFlag && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(59,130,246,0.3)', color: '#60a5fa', fontWeight: 700,
                      }}>TODAY</span>
                    )}
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600,
                    }}>
                      {items.length}品目
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: '#22c55e', fontFamily: 'var(--font-mono)',
                    }}>
                      {groupQty.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>REF</th>
                          <th style={thStyle}>工場出荷</th>
                          <th style={thStyle}>気高コード</th>
                          <th style={thStyle}>新建高コード</th>
                          <th style={thStyle}>規格</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>数量</th>
                          <th style={thStyle}>船便</th>
                          <th style={thStyle}>航次</th>
                          <th style={thStyle}>出港予定</th>
                          <th style={thStyle}>運送</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => (
                          <tr key={it.refNo + it.partNumber + i} style={{
                            borderTop: '1px solid rgba(255,255,255,0.03)',
                          }}>
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: '#fff' }}>{it.refNo}</td>
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{dateLabel(it.factoryShipDate)}</td>
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{it.partNumber}</td>
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)' }}>{it.newPartNumber}</td>
                            <td style={{ ...tdStyle, color: '#fff', fontWeight: 600 }}>{it.itemName}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                              {it.qty.toLocaleString()}
                            </td>
                            <td style={tdStyle}>{it.vesselName}</td>
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{it.voyage}</td>
                            <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{dateLabel(it.departureDate)}</td>
                            <td style={tdStyle}>{it.carrier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {groupedByArrival.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                条件に合致するレコードがありません
              </div>
            )}
          </div>
        ) : (
          /* 一覧テーブル */
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              条件に合致するレコードがありません
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: '100%' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 2, background: '#1e2130' }}>
                  <th style={{ ...thStyle, background: '#1e2130' }}>REF</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>工場出荷</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>気高コード</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>新建高コード</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>規格</th>
                  <th style={{ ...thStyle, background: '#1e2130', textAlign: 'right' }}>数量</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>注文番号</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>納期・宛先</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>船便</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>航次</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>出港予定</th>
                  <th style={{ ...thStyle, background: '#1e2130', color: '#60a5fa' }}>入港予定</th>
                  <th style={{ ...thStyle, background: '#1e2130' }}>運送</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, i) => (
                  <tr key={it.refNo + it.partNumber + i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isToday(it.arrivalDate) ? 'rgba(59,130,246,0.06)' : 'transparent',
                  }}>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: '#fff' }}>{it.refNo}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{dateLabel(it.factoryShipDate)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{it.partNumber}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)' }}>{it.newPartNumber}</td>
                    <td style={{ ...tdStyle, color: '#fff', fontWeight: 600 }}>{it.itemName}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                      {it.qty.toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{it.orderNo}</td>
                    <td style={tdStyle}>{it.delivery}</td>
                    <td style={tdStyle}>{it.vesselName}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{it.voyage}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{dateLabel(it.departureDate)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: '#60a5fa', fontWeight: 700 }}>
                      {dateLabel(it.arrivalDate)}
                    </td>
                    <td style={tdStyle}>{it.carrier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap',
};

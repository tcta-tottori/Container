'use client';

import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';

interface ItemListPanelProps {
  items: ContainerItem[];
  currentIdx: number;
  onSelect: (idx: number) => void;
}

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.ceil(v * 100) / 100);
}

function shortenName(name: string): string {
  return name.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || name;
}

const TYPE_ROW_BG: Record<string, string> = {
  'ポリカバー': '#162218', '箱': '#151e2c', '部品': '#1c1628', 'その他': '#1a1a1e',
};

export default function ItemListPanel({
  items, currentIdx, onSelect,
}: ItemListPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#141720' }}>
      {/* ヘッダー */}
      <div className="list-header-row" style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 12px', flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 9, fontWeight: 600, letterSpacing: 0.8,
        textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.5)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ flex: 1 }}>品名</span>
        <span style={{ width: 38, textAlign: 'center' }}>PL</span>
        <span style={{ width: 38, textAlign: 'center' }}>CS</span>
        <span className="list-col-extra" style={{ width: 46, textAlign: 'center' }}>CBM</span>
        <span className="list-col-extra" style={{ width: 70, textAlign: 'center' }}>Meas.</span>
        <span style={{ width: 50, textAlign: 'right' }}>PCS</span>
      </div>

      {/* リスト */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {items.map((item, idx) => {
          const c = COLOR_MAP[item.type] || COLOR_MAP['その他'];
          const isActive = idx === currentIdx;
          const typeBg = TYPE_ROW_BG[item.type] || TYPE_ROW_BG['その他'];

          return (
            <button key={item.id} onClick={() => onSelect(idx)}
              className={`detail-list-row ${isActive ? 'active' : ''}`}
              style={{
                width: '100%', textAlign: 'left' as const,
                background: isActive ? '#2a1f10' : typeBg,
                borderLeftColor: isActive ? '#ff6d00' : c.accent,
                borderLeftWidth: isActive ? 4 : 3,
                cursor: 'pointer',
              }}>
              <span className="detail-list-dot" style={{ backgroundColor: c.accent }} />
              <span className="detail-list-name" style={{
                color: isActive ? '#ff9800' : 'rgba(255,255,255,0.85)',
                fontWeight: isActive ? 700 : 500,
              }}>
                {shortenName(item.itemName)}
              </span>
              <span className="detail-list-num" style={{
                color: isActive ? '#ff9800' : c.accent, fontWeight: 600,
              }}>{fmtNum(item.palletCount)}</span>
              <span className="detail-list-num" style={{
                color: isActive ? '#ff9800' : 'rgba(255,255,255,0.7)',
              }}>{fmtNum(item.fraction)}</span>
              <span className="detail-list-num list-col-extra" style={{
                width: 46, fontSize: 11, color: item.cbm ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
              }}>{item.cbm ? item.cbm.toFixed(2) : '—'}</span>
              <span className="detail-list-num list-col-extra" style={{
                width: 70, fontSize: 9, color: item.measurements ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)',
              }}>{item.measurements || '—'}</span>
              <span className="detail-list-num detail-list-total" style={{
                color: 'rgba(255,255,255,0.55)',
              }}>{Math.ceil(item.totalQty).toLocaleString()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

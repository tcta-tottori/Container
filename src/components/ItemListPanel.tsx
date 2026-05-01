'use client';

import { useRef, useCallback } from 'react';
import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { getNabeModelColor, nabeColorToDarkBg } from '@/lib/nabeColors';

interface ItemListPanelProps {
  items: ContainerItem[];
  currentIdx: number;
  onSelect: (idx: number) => void;
  onComplete?: (id: string) => void;
}

/** スワイプで完了行 */
function SwipeCompleteRow({ children, onSwipe, onClick, style }: {
  children: React.ReactNode; onSwipe: () => void; onClick: () => void;
  style?: React.CSSProperties;
}) {
  const startX = useRef(0);
  const dx = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const onTS = useCallback((e: React.TouchEvent) => { startX.current = e.touches[0].clientX; dx.current = 0; }, []);
  const onTM = useCallback((e: React.TouchEvent) => {
    dx.current = e.touches[0].clientX - startX.current;
    if (rowRef.current && dx.current > 0) {
      rowRef.current.style.transform = `translateX(${Math.min(dx.current, 120)}px)`;
      rowRef.current.style.transition = 'none';
    }
  }, []);
  const parentRef = useRef<HTMLDivElement>(null);
  const onTE = useCallback(() => {
    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      if (dx.current > 80) {
        rowRef.current.style.transform = 'translateX(100%)';
        rowRef.current.style.opacity = '0';
        setTimeout(() => {
          // 親要素もスライドアウトして消す
          if (parentRef.current) {
            parentRef.current.style.transition = 'max-height 0.3s ease, opacity 0.2s ease';
            parentRef.current.style.maxHeight = '0';
            parentRef.current.style.opacity = '0';
          }
          setTimeout(() => onSwipe(), 300);
        }, 260);
      } else { rowRef.current.style.transform = 'translateX(0)'; }
    }
  }, [onSwipe]);
  return (
    <div ref={parentRef} style={{ overflow: 'hidden', position: 'relative', maxHeight: 200 }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%',
        background: 'linear-gradient(90deg, #00ff88, #22ff66)',
        display: 'flex', alignItems: 'center', paddingLeft: 12,
        color: '#fff', fontSize: 12, fontWeight: 800,
        textShadow: '0 0 10px rgba(0,255,136,0.8), 0 0 20px rgba(0,255,136,0.4)',
        boxShadow: 'inset 0 0 20px rgba(0,255,136,0.3)',
      }}>✓ 完了</div>
      <div ref={rowRef} style={{ ...style, position: 'relative', zIndex: 1 }}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onClick={onClick}
      >{children}</div>
    </div>
  );
}

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.ceil(v * 100) / 100);
}

function shortenName(name: string): string {
  return name.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || name;
}

const TYPE_ROW_BG: Record<string, string> = {
  'ポリカバー': '#162218', 'ジャーポット': '#1e1520', '箱': '#151e2c', '部品': '#1c1628', '鍋': '#1e1518', 'ヤーマン部品': '#1c1a14', 'その他': '#1a1a1e',
};

export default function ItemListPanel({
  items, currentIdx, onSelect, onComplete,
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
        <span style={{ width: 32, textAlign: 'center' }}>PL</span>
        <span style={{ width: 32, textAlign: 'center' }}>CT</span>
        <span style={{ width: 50, textAlign: 'right' }}>PCS</span>
        <span className="list-col-extra" style={{ width: 70, textAlign: 'center' }}>MEAS.</span>
      </div>

      {/* リスト */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {items.map((item, idx) => {
          const c = COLOR_MAP[item.type] || COLOR_MAP['その他'];
          const isActive = idx === currentIdx;
          // 鍋は機種別カラーを使用
          const nabeColor = getNabeModelColor(item.itemName, item.type);
          const accentColor = nabeColor || c.accent;
          const typeBg = nabeColor ? nabeColorToDarkBg(nabeColor) : (TYPE_ROW_BG[item.type] || TYPE_ROW_BG['その他']);

          const rowContent = (
            <div key={item.id}
              className={`detail-list-row ${isActive ? 'active' : ''}`}
              style={{
                width: '100%', textAlign: 'left' as const,
                background: isActive ? '#2a1f10' : typeBg,
                borderLeftColor: isActive ? '#ff6d00' : accentColor,
                borderLeftWidth: isActive ? 4 : 3,
                cursor: 'pointer',
              }}>
              <span className="detail-list-dot" style={{ backgroundColor: accentColor }} />
              <span className="detail-list-name" style={{
                color: isActive ? '#ff9800' : (nabeColor ? nabeColor : 'rgba(255,255,255,0.85)'),
                fontWeight: isActive ? 700 : 500,
              }}>
                {shortenName(item.itemName)}
              </span>
              <span className="detail-list-num" style={{
                width: 32, color: isActive ? '#ff9800' : accentColor, fontWeight: 600,
              }}>{fmtNum(item.palletCount)}</span>
              <span className="detail-list-num" style={{
                width: 32, color: isActive ? '#ff9800' : 'rgba(255,255,255,0.7)',
              }}>{item.fraction % 1 !== 0 ? Math.ceil(item.fraction) : fmtNum(item.fraction)}</span>
              <span className="detail-list-num detail-list-total" style={{
                width: 50, color: 'rgba(255,255,255,0.55)',
              }}>{Math.ceil(item.totalQty).toLocaleString()}</span>
              <span className="detail-list-num list-col-extra" style={{
                width: 70, fontSize: 9, color: item.measurements ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{item.measurements || '—'}</span>
            </div>
          );
          return onComplete ? (
            <SwipeCompleteRow key={item.id} onSwipe={() => onComplete(item.id)} onClick={() => onSelect(idx)}
              style={{ background: isActive ? '#2a1f10' : typeBg }}>
              {rowContent}
            </SwipeCompleteRow>
          ) : (
            <div key={item.id} onClick={() => onSelect(idx)} style={{ cursor: 'pointer' }}>{rowContent}</div>
          );
        })}
        <div style={{ height: 60, flexShrink: 0 }} />
      </div>
    </div>
  );
}

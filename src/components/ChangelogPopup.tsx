'use client';

import { APP_VERSION, APP_UPDATED, CHANGELOG } from '@/lib/appVersion';
import { CloseIcon } from '@/components/AppIcons';

/* ===== CNSロゴSVG（正方形キューブ） ===== */
function CnsLogo({ size = 30 }: { size?: number }) {
  const s = 18;
  const h = s * 0.58;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: 'block' }}>
      <g transform="translate(32,30)" stroke="#fff" strokeWidth="3.8" strokeLinejoin="round" fill="none">
        <polygon points={`0,${-h * 2} ${s},${-h} 0,0 ${-s},${-h}`} />
        <polygon points={`${-s},${-h} 0,0 0,${h * 2} ${-s},${h}`} />
        <polygon points={`${s},${-h} 0,0 0,${h * 2} ${s},${h}`} />
      </g>
    </svg>
  );
}

/** バージョン情報・更新内容のポップアップ（メニュー下部から開く） */
export default function ChangelogPopup({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        padding: 16, animation: 'fadeIn 0.18s ease both',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'linear-gradient(160deg, #1e2235 0%, #252a40 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 20, width: '100%', maxWidth: 400,
        maxHeight: '84vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CnsLogo size={32} />
            </div>
            <div>
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 }}>
                CNS <span style={{ fontFamily: 'var(--font-mono)' }}>Ver {APP_VERSION}</span>
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>
                Container Navigation System · Updated {APP_UPDATED}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{
            width: 30, height: 30, borderRadius: 9, border: 'none',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CloseIcon size={15} />
          </button>
        </div>
        {CHANGELOG.map((log) => (
          <div key={log.ver} style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 12,
            padding: '14px 16px', marginBottom: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 10px',
                borderRadius: 12, fontFamily: 'var(--font-mono)',
              }}>Ver {log.ver}</span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{log.date}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {log.changes.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.5 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{c.icon}</span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

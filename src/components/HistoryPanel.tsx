'use client';

import { useEffect, useState } from 'react';
import { HistoryEntry, getHistory, downloadHistoryFile } from '@/lib/historyManager';

export default function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory().then(e => { setEntries(e); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
        読み込み中...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        更新履歴はまだありません
      </div>
    );
  }

  const fmtTs = (ts: string) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
        更新履歴（過去{entries.length}件）
      </div>
      {entries.map((entry, idx) => (
        <div key={entry.id} style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 10,
          padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#60a5fa', fontFamily: 'var(--font-mono)',
              width: 22, textAlign: 'center',
            }}>#{idx + 1}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
              {fmtTs(entry.timestamp)}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, flex: 1 }}>
              {entry.description}
            </span>
          </div>
          {entry.files.map((file, fi) => (
            <div key={fi} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
            }}>
              <span style={{ fontSize: 12 }}>{file.type === 'jkp' ? '🍲' : '📄'}</span>
              <span style={{
                flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.6)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{file.filename}</span>
              <button onClick={() => downloadHistoryFile(file)} style={{
                fontSize: 9, padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 700,
              }}>DL</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { getRecentFiles, base64ToFile, RecentFile } from '@/lib/recentFiles';

interface FileDropZoneProps {
  onFileLoaded: (file: File) => void;
}

export default function FileDropZone({ onFileLoaded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('spreadsheet')) {
        onFileLoaded(file);
      }
    },
    [onFileLoaded]
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const loadRecent = useCallback((entry: RecentFile) => {
    const file = base64ToFile(entry);
    onFileLoaded(file);
  }, [onFileLoaded]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>
        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            marginBottom: 12, boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
            コンテナ荷降ろし管理
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
            Excelファイルを読み込んで開始
          </p>
        </div>

        {/* ドロップゾーン */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#3b82f6' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 16, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
            background: isDragging ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{
            width: 48, height: 48, margin: '0 auto 12px', borderRadius: 12,
            background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/>
            </svg>
          </div>
          <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>
            ファイルをドラッグ＆ドロップ
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
            またはタップして選択（.xlsx / .xls）
          </p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="hidden" />
        </div>

        {/* 最近のファイル */}
        {recentFiles.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
              最近のファイル
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentFiles.map((entry) => (
                <button key={entry.name + entry.date} onClick={() => loadRecent(entry)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)', cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, margin: '2px 0 0' }}>
                      {formatDate(entry.date)} · {entry.containerCount}コンテナ · {entry.itemCount}品目
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

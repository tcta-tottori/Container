'use client';

import { useCallback, useRef, useState } from 'react';

interface FileDropZoneProps {
  onFileLoaded: (file: File) => void;
}

export default function FileDropZone({ onFileLoaded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.type.includes('spreadsheet')
      ) {
        onFileLoaded(file);
      }
    },
    [onFileLoaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      className="flex items-center justify-center h-screen w-screen"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
      >
        <div className="drop-zone-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="12" y2="12"/>
            <line x1="15" y1="15" x2="12" y2="12"/>
          </svg>
        </div>
        <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          Excelファイルをドラッグ＆ドロップ
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          またはタップして選択
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

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
    <div className="flex items-center justify-center h-screen w-screen bg-gray-900">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-4 border-dashed p-12 text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-900/30'
            : 'border-gray-600 bg-gray-800 hover:border-gray-400'
        }`}
      >
        <p className="text-5xl mb-4">📦</p>
        <p className="text-xl font-bold text-white mb-2">
          Excelファイルをドラッグ＆ドロップ
        </p>
        <p className="text-gray-400">
          またはタップして「コンテナ日程.xlsx」を選択
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

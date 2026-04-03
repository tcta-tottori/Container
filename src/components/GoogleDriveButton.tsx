'use client';

import { useCallback } from 'react';
import { openGooglePicker, downloadFromDrive } from '@/lib/googleDrive';

interface GoogleDriveButtonProps {
  onFilesLoaded: (files: File[]) => void;
  onLoading?: (msg: string | null) => void;
}

export default function GoogleDriveButton({ onFilesLoaded, onLoading }: GoogleDriveButtonProps) {
  const handlePick = useCallback(async () => {
    try {
      onLoading?.('Googleドライブからファイルを選択中...');
      const picked = await openGooglePicker();
      if (!picked || picked.length === 0) {
        onLoading?.(null);
        return;
      }

      onLoading?.(`${picked.length}件のファイルをダウンロード中...`);
      const files: File[] = [];
      for (const p of picked) {
        const file = await downloadFromDrive(p.id, p.name);
        files.push(file);
      }

      onLoading?.(null);
      onFilesLoaded(files);
    } catch (err) {
      console.error('Google Drive error:', err);
      onLoading?.(`エラー: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => onLoading?.(null), 3000);
    }
  }, [onFilesLoaded, onLoading]);

  return (
    <button onClick={handlePick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 12,
      background: 'rgba(66,133,244,0.08)',
      border: '1.5px solid rgba(66,133,244,0.25)',
      cursor: 'pointer', transition: 'all 0.2s',
      color: '#4285f4',
      fontSize: 12, fontWeight: 600,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M7.71 3.5L1.15 15l3.43 5.99L11.14 9.5z" fill="#0066DA"/>
        <path d="M16.29 3.5H7.71l6.57 11.5h8.57z" fill="#00AC47"/>
        <path d="M22.85 15H14.28l-3.43 6h8.57z" fill="#EA4335"/>
        <path d="M14.28 15l3.43-6-1.42-2.5L7.71 3.5l6.57 11.5z" fill="#00832D" opacity="0.5"/>
      </svg>
      Google ドライブ
    </button>
  );
}

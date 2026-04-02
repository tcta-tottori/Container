'use client';

import { useState, useCallback } from 'react';
import { isGoogleConfigured, openGooglePicker, downloadFromDrive, saveGoogleConfig, clearGoogleToken } from '@/lib/googleDrive';

interface GoogleDriveButtonProps {
  onFilesLoaded: (files: File[]) => void;
  onLoading?: (msg: string | null) => void;
}

export default function GoogleDriveButton({ onFilesLoaded, onLoading }: GoogleDriveButtonProps) {
  const [showSetup, setShowSetup] = useState(false);
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [folderId, setFolderId] = useState('');
  const configured = isGoogleConfigured();

  const handlePick = useCallback(async () => {
    if (!configured) {
      setShowSetup(true);
      return;
    }

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
  }, [configured, onFilesLoaded, onLoading]);

  const handleSaveConfig = useCallback(() => {
    if (clientId.trim() && apiKey.trim()) {
      saveGoogleConfig(clientId.trim(), apiKey.trim(), folderId.trim() || undefined);
      clearGoogleToken();
      setShowSetup(false);
    }
  }, [clientId, apiKey, folderId]);

  return (
    <>
      <button onClick={handlePick} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 12,
        background: configured ? 'rgba(66,133,244,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${configured ? 'rgba(66,133,244,0.25)' : 'rgba(255,255,255,0.08)'}`,
        cursor: 'pointer', transition: 'all 0.2s',
        color: configured ? '#4285f4' : 'rgba(255,255,255,0.4)',
        fontSize: 12, fontWeight: 600,
      }}>
        {/* Google Drive icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7.71 3.5L1.15 15l3.43 5.99L11.14 9.5z" fill="#0066DA"/>
          <path d="M16.29 3.5H7.71l6.57 11.5h8.57z" fill="#00AC47"/>
          <path d="M22.85 15H14.28l-3.43 6h8.57z" fill="#EA4335"/>
          <path d="M14.28 15l3.43-6-1.42-2.5L7.71 3.5l6.57 11.5z" fill="#00832D" opacity="0.5"/>
        </svg>
        {configured ? 'Google ドライブ' : 'Google ドライブ設定'}
      </button>

      {/* 設定ダイアログ */}
      {showSetup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        }} onClick={() => setShowSetup(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'linear-gradient(160deg, #1e2235, #252a40)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: 24, width: '90%', maxWidth: 380,
          }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>
              Google ドライブ設定
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: '0 0 12px', lineHeight: 1.5 }}>
              Google Cloud ConsoleでOAuth 2.0クライアントIDとAPIキーを取得し、以下に入力してください。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600 }}>Client ID</label>
                <input value={clientId} onChange={e => setClientId(e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, marginTop: 4,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 12, fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600 }}>API Key</label>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, marginTop: 4,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 12, fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600 }}>フォルダID（任意）</label>
                <input value={folderId} onChange={e => setFolderId(e.target.value)}
                  placeholder="GoogleドライブのフォルダURLから取得"
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8, marginTop: 4,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 12, fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }} />
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, margin: '3px 0 0', lineHeight: 1.4 }}>
                  drive.google.com/drive/folders/<b>xxxxxx</b> のxxxxxx部分
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setShowSetup(false)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
                }}>キャンセル</button>
                <button onClick={handleSaveConfig} disabled={!clientId.trim() || !apiKey.trim()} style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                  background: clientId.trim() && apiKey.trim() ? '#4285f4' : '#333',
                  color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>保存</button>
              </div>
              {configured && (
                <p style={{ color: 'rgba(66,133,244,0.7)', fontSize: 10, textAlign: 'center', margin: '4px 0 0' }}>
                  ✓ 設定済み（変更する場合は上書き保存）
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

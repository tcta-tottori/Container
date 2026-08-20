'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DriveFile, driveErrorMessage, listDriveFiles } from '@/lib/googleDrive';
import { classifyFile, isImageFile } from '@/lib/fileClassifier';

interface GoogleDrivePickerProps {
  /** ファイルを選んだとき。タップした時点でそのまま読み込みへ進む */
  onSelect: (files: DriveFile[]) => void;
  /** 閉じる（何も選ばずに戻る） */
  onClose: () => void;
}

/**
 * 一覧に出すファイルか。
 * 作業に使うのは「コンテナ」日程と「JKP」出荷スケジュールだけなので、
 * 名前にどちらかが入っているものに絞る。フォルダは中を見られるよう常に残す。
 */
function isTargetFile(f: DriveFile): boolean {
  if (f.isFolder) return true;
  const name = f.name.toUpperCase();
  return name.includes('コンテナ') || name.includes('JKP');
}

/** 更新日を「8/6」「2025/8/6」のような短い形にする */
function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}/${md}`;
}

/** ファイルの大きさを KB / MB で */
function shortSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ===== 一覧に出すアイコン ===== */
function FolderGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="rgba(138,180,255,0.18)" stroke="#8ab4ff" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function ExcelGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        fill="rgba(34,197,94,0.16)" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12.5l4 5M13 12.5l-4 5" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function PhotoGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2"
        fill="rgba(168,85,247,0.16)" stroke="#c084fc" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.6" fill="#c084fc" />
      <path d="M5 17l4.5-4.5 3 3 2.5-2.5L19 17" stroke="#c084fc" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Googleドライブのファイルをアプリの中だけで選ぶ画面。
 * コンテナ・JKP のファイルだけを新しい順に並べ、タップしたらすぐ読み込みへ進む。
 */
export default function GoogleDrivePicker({ onSelect, onClose }: GoogleDrivePickerProps) {
  /** いま開いているフォルダ。先頭が CNS フォルダ（id 未指定 = 既定のフォルダ） */
  const [path, setPath] = useState<{ id?: string; name: string }[]>([{ name: 'CNS' }]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 読み直し用。押すたびに増やして取得をやり直す */
  const [reloadKey, setReloadKey] = useState(0);

  const current = path[path.length - 1];

  // フォルダを開くたびに中身を取りに行く
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listDriveFiles(current.id)
      .then((list) => { if (alive) setFiles(list); })
      .catch((err: unknown) => {
        if (alive) setError(driveErrorMessage(err));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [current.id, reloadKey]);

  /** 対象のファイルだけを、フォルダを先頭・更新の新しい順に並べる */
  const shown = useMemo(() => {
    return files.filter(isTargetFile).sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
    });
  }, [files]);

  /** タップ。フォルダなら中へ、ファイルならそのまま読み込みへ */
  const handleTap = useCallback((f: DriveFile) => {
    if (f.isFolder) {
      setPath((prev) => [...prev, { id: f.id, name: f.name }]);
      return;
    }
    onSelect([f]);
  }, [onSelect]);

  // Esc で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="gdrive-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Googleドライブからファイルを選択">
      <div className="gdrive-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="gdrive-grip" aria-hidden />

        {/* 見出し（いまの場所と閉じるボタン） */}
        <div className="gdrive-head">
          <div className="gdrive-head-text">
            <p className="gdrive-title">読み込むファイルを選ぶ</p>
            <div className="gdrive-crumbs">
              {path.map((p, i) => (
                <span key={`${p.id ?? 'root'}-${i}`}>
                  {i > 0 && <span className="gdrive-crumb-sep">/</span>}
                  <button
                    type="button"
                    className={`gdrive-crumb${i === path.length - 1 ? ' current' : ''}`}
                    onClick={() => { if (i < path.length - 1) setPath(path.slice(0, i + 1)); }}
                  >
                    {p.name}
                  </button>
                </span>
              ))}
            </div>
          </div>
          <button type="button" className="gdrive-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        {/* 一覧。タップした時点で読み込みが始まる */}
        <div className="gdrive-list">
          {loading && (
            <div className="gdrive-state">
              <span className="gdrive-spinner" aria-hidden />
              <p>Googleドライブに接続中...</p>
            </div>
          )}

          {!loading && error && (
            <div className="gdrive-state">
              <p className="gdrive-error">{error}</p>
              <button type="button" className="gdrive-retry" onClick={() => setReloadKey((k) => k + 1)}>
                もう一度試す
              </button>
            </div>
          )}

          {!loading && !error && shown.length === 0 && (
            <div className="gdrive-state">
              <p>コンテナ・JKP のファイルがありません</p>
            </div>
          )}

          {!loading && !error && shown.map((f) => {
            const { label } = f.isFolder ? { label: 'フォルダ' } : classifyFile(f.name);
            return (
              <button type="button" key={f.id} className="gdrive-row" onClick={() => handleTap(f)}>
                <span className="gdrive-row-icon">
                  {f.isFolder ? <FolderGlyph /> : isImageFile(f.name) ? <PhotoGlyph /> : <ExcelGlyph />}
                </span>
                <span className="gdrive-row-text">
                  <span className="gdrive-row-name">{f.name}</span>
                  <span className="gdrive-row-meta">
                    <span className="gdrive-row-label">{label}</span>
                    {shortDate(f.modifiedTime) && <span>{shortDate(f.modifiedTime)}</span>}
                    {shortSize(f.size) && <span>{shortSize(f.size)}</span>}
                  </span>
                </span>
                <span className="gdrive-row-chevron" aria-hidden>›</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

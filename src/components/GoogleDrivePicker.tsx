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
 * 作業に使うのは「コンテナ」日程・「JKP」出荷スケジュール・「AQSS04L」インボイスなので、
 * 名前にどれかが入っているものに絞る。フォルダは中を見られるよう常に残す。
 *
 * AQSS05L（パッキングリスト）は単体では作業を始められないため一覧には出さない。
 * AQSS04L を選んだときに、同じ出荷ぶんがあれば裏で一緒に読み込む（findPackingFor）。
 */
function isTargetFile(f: DriveFile): boolean {
  if (f.isFolder) return true;
  const name = f.name.toUpperCase();
  return name.includes('コンテナ') || name.includes('JKP') || name.includes('AQSS04L');
}

/** AQSS04L / AQSS05L のファイル名に続く連番（YYYYMMDDhhmmssSSS）を取り出す */
function aqssSerial(name: string, kind: '04' | '05'): string | null {
  const m = name.toUpperCase().match(new RegExp(`AQSS${kind}L[_-]?(\\d{8,})`));
  return m ? m[1] : null;
}

/**
 * AQSS04L（インボイス）と同じ出荷の AQSS05L（パッキングリスト）を同じフォルダから探す。
 * 04L だけでも読み込めるが、05L があると寸法・重量・CBM まで入る。
 *
 * 連番は書き出した日時なので、頭から一致している桁が多いものほど同じ出荷。
 * 少なくとも日付（先頭8桁）が合っていなければ別の出荷とみなす。
 */
function findPackingFor(invoiceName: string, files: DriveFile[]): DriveFile | undefined {
  const inv = aqssSerial(invoiceName, '04');
  if (!inv) return undefined;

  let best: { file: DriveFile; matched: number } | undefined;
  for (const f of files) {
    if (f.isFolder) continue;
    const pk = aqssSerial(f.name, '05');
    if (!pk) continue;
    let matched = 0;
    while (matched < inv.length && matched < pk.length && inv[matched] === pk[matched]) matched++;
    if (matched < 8) continue;
    if (!best || matched > best.matched) best = { file: f, matched };
  }
  return best?.file;
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
 * コンテナ・JKP・AQSS04L のファイルだけを新しい順に並べ、タップしたらすぐ読み込みへ進む。
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
    // AQSS04L は、同じ出荷の AQSS05L があれば一緒に渡す（寸法・重量が入る）
    const packing = findPackingFor(f.name, files);
    onSelect(packing ? [f, packing] : [f]);
  }, [onSelect, files]);

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
              <p>コンテナ・JKP・AQSS04L のファイルがありません</p>
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

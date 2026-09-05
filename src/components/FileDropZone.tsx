'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { fetchMasterFileLastUpdate } from '@/lib/masterLoader';
import { classifyFile, isImageFile, isExcelFile, ClassifiedFile } from '@/lib/fileClassifier';
import { FileIcon } from '@/components/AppIcons';

export type { FileRole, ClassifiedFile } from '@/lib/fileClassifier';
export { classifyFile, isImageFile, isExcelFile } from '@/lib/fileClassifier';

interface FileDropZoneProps {
  onFileLoaded: (file: File) => void;
  onAqssLoaded?: (files: File[]) => void;
  onAqssContainerLoaded?: (invoiceFile: File, packingFile?: File) => void;
  onJkpLoaded?: (file: File) => void;
  onMasterLoaded?: (file: File) => void;
  onPhotoLoaded?: (file: File) => void;
  onMultiFilesLoaded?: (classified: ClassifiedFile[]) => void;
  /** 作業画面のレイアウト内に埋め込んで表示する（ヘッダー・メニューを残す） */
  embedded?: boolean;
}

/* ===== CNSロゴSVG（正方形キューブ + ネオングロー） ===== */
function CnsLogo({ size = 56 }: { size?: number }) {
  // 正方形キューブ: 辺の長さを統一（上面の幅 = 側面の高さ）
  const s = 18; // 辺の投影長さ
  const h = s * 0.58; // 高さ方向の投影 (sin30° ≈ 0.5 + 微調整)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', filter: 'drop-shadow(0 0 3px rgba(138,180,255,0.6)) drop-shadow(0 0 6px rgba(138,180,255,0.3))' }}>
      <g transform="translate(32,30)" stroke="#fff" strokeWidth="3.8" strokeLinejoin="round" fill="none">
        <polygon points={`0,${-h*2} ${s},${-h} 0,0 ${-s},${-h}`}/>
        <polygon points={`${-s},${-h} 0,0 0,${h*2} ${-s},${h}`}/>
        <polygon points={`${s},${-h} 0,0 0,${h*2} ${s},${h}`}/>
      </g>
    </svg>
  );
}

/** ドロップゾーンを押したときに出す選び方のボタン */
function PickButton({ label, hint, icon, onClick }: {
  label: string; hint: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="cns-action-btn"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '14px 16px', borderRadius: 14, textAlign: 'left',
        background: 'rgba(107,82,212,0.18)',
        border: '1.5px solid rgba(155,69,201,0.35)',
        color: '#fff', cursor: 'pointer', transition: 'background 0.2s ease',
      }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(155,69,201,0.22)', color: '#c4b5fd',
      }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{hint}</span>
      </span>
    </button>
  );
}

export default function FileDropZone({ onFileLoaded, onAqssLoaded, onAqssContainerLoaded, onJkpLoaded, onMasterLoaded, onPhotoLoaded, onMultiFilesLoaded, embedded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [masterLastUpdate, setMasterLastUpdate] = useState<{ date: string; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** その場で撮る用（アプリではカメラが開く） */
  const cameraRef = useRef<HTMLInputElement>(null);
  /** 押したときに出す「ファイルを選ぶ / 写真を撮る」 */
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    // マスタファイルの最終更新情報を取得
    fetchMasterFileLastUpdate().then((info) => {
      if (info) setMasterLastUpdate(info);
    });
  }, []);

  // ファイル名で自動判別・振り分け（読込を始めたら true を返す）
  const handleFiles = useCallback(
    (files: FileList | File[]): boolean => {
      const classified: ClassifiedFile[] = [];
      const aqssFiles: File[] = [];
      let containerFile: File | null = null;
      /** どれか1つでも読込へ渡せたか。渡せなければ呼び出し側でローディングを消す */
      let started = false;

      for (const f of Array.from(files)) {
        const isExcel = isExcelFile(f.name);
        const isImage = isImageFile(f.name);
        if (!isExcel && !isImage) continue;
        const { role, label } = classifyFile(f.name);
        classified.push({ file: f, role, label });

        if (role === 'photo') {
          // 画像ファイル → OCRで読込
          if (onPhotoLoaded) { onPhotoLoaded(f); started = true; }
        } else if (role === 'aqss04l' || role === 'aqss05l') {
          aqssFiles.push(f);
        } else if (role === 'jkp') {
          if (onJkpLoaded) { onJkpLoaded(f); started = true; }
        } else if (role === 'master') {
          // マスターデータ（CNS品目一覧）→ 直接読込・反映
          if (onMasterLoaded) { onMasterLoaded(f); started = true; }
        } else if (role === 'container' || role === 'container_schedule') {
          // コンテナ作業ファイルとコンテナ日程は両方ともコンテナとして読込
          containerFile = f;
        }
      }

      setClassifiedFiles(classified);

      if (onMultiFilesLoaded && classified.length > 0) {
        onMultiFilesLoaded(classified);
      }

      // コンテナファイルがあれば即読込・作業ページへ遷移
      if (containerFile) {
        onFileLoaded(containerFile);
        started = true;
        // コンテナファイルと同時にAQSSがあれば既存データ補完
        if (aqssFiles.length > 0 && onAqssLoaded) onAqssLoaded(aqssFiles);
      } else if (aqssFiles.length > 0) {
        // AQSSファイルのみ → コンテナとして新規作成
        const inv = aqssFiles.find(f => f.name.toUpperCase().includes('AQSS04L'));
        const pk = aqssFiles.find(f => f.name.toUpperCase().includes('AQSS05L'));
        if (inv && onAqssContainerLoaded) {
          onAqssContainerLoaded(inv, pk);
          started = true;
        } else if (onAqssLoaded) {
          onAqssLoaded(aqssFiles);
          started = true;
        }
      }

      return started;
    },
    [onFileLoaded, onAqssLoaded, onAqssContainerLoaded, onJkpLoaded, onMasterLoaded, onPhotoLoaded, onMultiFilesLoaded]
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const gradientStyle = 'linear-gradient(135deg, #4a7af7 0%, #6b52d4 35%, #9b45c9 65%, #c0549a 100%)';

  return (
    <div className={`filedrop-root flex items-center justify-center ${embedded ? 'w-full h-full' : 'h-screen w-screen'}`}
      style={{ background: 'linear-gradient(160deg, #0c0a1d 0%, #141028 30%, #0e1225 70%, #0a0c1e 100%)', overflow: 'auto' }}>
      <div className="drop-zone-root" style={{ width: '100%', maxWidth: 800, padding: '0 20px' }}>

        {/* 横画面: 2カラム構成 */}
        <div className="drop-zone-columns">
          {/* 左カラム: ロゴ+タイトル */}
          <div className="drop-zone-left">
            {/* タイトル（バージョン表示はメニュー下部へ移動） */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 76, height: 76, borderRadius: 22,
                background: gradientStyle,
                animation: 'logo-hue-shift 12s ease-in-out infinite',
                marginBottom: 14,
                boxShadow: '0 8px 32px rgba(75,122,247,0.25), 0 0 20px rgba(107,82,212,0.2), 0 0 48px rgba(155,69,201,0.12)',
              }}>
                <CnsLogo size={60} />
              </div>
              <h1 style={{
                fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', fontFamily: 'Inter, sans-serif',
                background: gradientStyle,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'logo-hue-shift 12s ease-in-out infinite',
              }}>
                Container Navigation System
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 4, letterSpacing: 1 }}>
                コンテナ荷降ろし管理
              </p>
            </div>
          </div>{/* 左カラム閉じ */}

          {/* 右カラム: ドロップゾーン（押すとファイル選択か写真撮影かを選ぶ） */}
          <div className="drop-zone-right">

            {/* ドロップゾーン */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => setPickOpen(true)}
              style={{
                border: `2px dashed ${isDragging ? 'rgba(107,82,212,0.6)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 16, padding: '26px 16px', textAlign: 'center', cursor: 'pointer',
                background: isDragging ? 'rgba(107,82,212,0.06)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{
                width: 48, height: 48, margin: '0 auto 10px', borderRadius: 12,
                background: 'rgba(107,82,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9b7ae8',
              }}>
                <FileIcon size={24} strokeWidth={1.5} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600, margin: '0 0 5px' }}>
                Excel / 写真をドラッグ＆ドロップ
              </p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: 0 }}>
                またはタップして「ファイルを選ぶ / 写真を撮る」（.xlsx / .xlsm / .xls / .jpg / .png）
              </p>
              {classifiedFiles.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {classifiedFiles.map((cf, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                      padding: '5px 9px', borderRadius: 8,
                      background: cf.role === 'unknown' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.06)',
                    }}>
                      <span style={{ color: cf.role === 'unknown' ? '#ef4444' : '#22c55e', fontSize: 12 }}>
                        {cf.role === 'unknown' ? '⚠' : '✓'}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{cf.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cf.file.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* 押したら出る選び方。枠の中にそのまま出す */}
              {pickOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <PickButton
                    label="ファイルを選ぶ"
                    hint="Excel / 保存済みの写真"
                    onClick={() => { setPickOpen(false); inputRef.current?.click(); }}
                    icon={
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                      </svg>
                    }
                  />
                  <PickButton
                    label="写真を撮る"
                    hint="コンテナ日程の紙をその場で撮る"
                    onClick={() => { setPickOpen(false); cameraRef.current?.click(); }}
                    icon={
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    }
                  />
                  <button
                    onClick={() => setPickOpen(false)}
                    style={{
                      padding: '8px', borderRadius: 10, background: 'transparent', border: 'none',
                      color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    やめる
                  </button>
                </div>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,image/*" multiple
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                className="hidden" />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                className="hidden" />
            </div>

          </div>{/* 右カラム閉じ */}
        </div>{/* columns閉じ */}
      </div>

    </div>
  );
}

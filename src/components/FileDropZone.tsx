'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { fetchMasterFileLastUpdate } from '@/lib/masterLoader';
import { DriveFile, downloadFromDrive, driveErrorMessage } from '@/lib/googleDrive';
import { classifyFile, isImageFile, isExcelFile, ClassifiedFile } from '@/lib/fileClassifier';
import { FileIcon } from '@/components/AppIcons';
import GoogleDrivePicker from '@/components/GoogleDrivePicker';

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
  /**
   * Googleドライブから取ってくる間の表示。
   * ここで読込画面のローディングを出しておくと、選んだあと作業ページに着くまで
   * 画面が途切れない。msg に null を渡すと消す。
   */
  onLoadingChange?: (msg: string | null, progress?: number) => void;
  /** 作業画面のレイアウト内に埋め込んで表示する（ヘッダー・メニューを残す） */
  embedded?: boolean;
}

/**
 * ドライブから取ってくる間に使う進捗の幅。
 * このあとの解析はここから先を受け持つ（読込画面の進捗は戻らないようにしてある）。
 */
const DRIVE_PROGRESS_MAX = 45;

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

/* ===== Google ドライブ公式ロゴ ===== */
function GoogleDriveLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size * 78 / 87.3} viewBox="0 0 87.3 78" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  );
}

export default function FileDropZone({ onFileLoaded, onAqssLoaded, onAqssContainerLoaded, onJkpLoaded, onMasterLoaded, onPhotoLoaded, onMultiFilesLoaded, onLoadingChange, embedded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  /** アプリ内のドライブ選択画面を開いているか */
  const [pickerOpen, setPickerOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [masterLastUpdate, setMasterLastUpdate] = useState<{ date: string; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  /**
   * アプリ内で選んだファイルを取ってくる。
   * 選び終わった時点で読込画面のローディングへ切り替わり、
   * 取得が終わるとそのまま解析（作業ページへの遷移）へ続く。
   */
  const loadFromDrive = useCallback(async (picked: DriveFile[]) => {
    setPickerOpen(false);
    if (picked.length === 0) return;
    setDriveBusy(true);
    try {
      const files: File[] = [];
      for (let i = 0; i < picked.length; i++) {
        const p = picked[i];
        const label = picked.length > 1
          ? `Googleドライブから読み込み中... (${i + 1}/${picked.length})`
          : 'Googleドライブから読み込み中...';
        // 1ファイルぶんの取得を、全体の進捗のうちの1区画として進める
        const slice = DRIVE_PROGRESS_MAX / picked.length;
        onLoadingChange?.(`${label}\n${p.name}`, slice * i);
        const file = await downloadFromDrive(p, (ratio) => {
          onLoadingChange?.(`${label}\n${p.name}`, slice * (i + ratio));
        });
        files.push(file);
      }

      onLoadingChange?.('ファイルを確認中...', DRIVE_PROGRESS_MAX);
      // ここから先は各ファイルの読込処理がローディングの続きを受け持つ
      const started = handleFiles(files);
      if (!started) onLoadingChange?.(null);
    } catch (err) {
      onLoadingChange?.(driveErrorMessage(err));
      setTimeout(() => onLoadingChange?.(null), 2600);
    } finally {
      setDriveBusy(false);
    }
  }, [handleFiles, onLoadingChange]);

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

          {/* 右カラム: ドロップゾーン + Googleドライブ */}
          <div className="drop-zone-right">

            {/* ドロップゾーン */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => inputRef.current?.click()}
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
                またはタップして選択（.xlsx / .xlsm / .xls / .jpg / .png）
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
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,image/*" multiple
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                className="hidden" />
            </div>

            {/* ===== Google ドライブ（ドロップゾーンと同じ横幅の大ボタン） ===== */}
            <button
              onClick={() => setPickerOpen(true)}
              disabled={driveBusy}
              className="cns-action-btn"
              style={{
                marginTop: 14, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '18px 20px', borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(66,133,244,0.25) 0%, rgba(107,82,212,0.25) 50%, rgba(155,69,201,0.25) 100%)',
                border: '1.5px solid rgba(66,133,244,0.35)',
                cursor: driveBusy ? 'wait' : 'pointer', transition: 'all 0.3s ease',
                color: '#fff', fontSize: 16, fontWeight: 700,
                boxShadow: '0 0 16px rgba(66,133,244,0.15), 0 0 32px rgba(107,82,212,0.08)',
                textShadow: '0 0 12px rgba(138,180,255,0.5)',
                letterSpacing: 0.3, opacity: driveBusy ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66,133,244,0.4) 0%, rgba(107,82,212,0.4) 50%, rgba(155,69,201,0.4) 100%)';
                e.currentTarget.style.boxShadow = '0 0 24px rgba(66,133,244,0.3), 0 0 48px rgba(107,82,212,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66,133,244,0.25) 0%, rgba(107,82,212,0.25) 50%, rgba(155,69,201,0.25) 100%)';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(66,133,244,0.15), 0 0 32px rgba(107,82,212,0.08)';
              }}
            >
              <GoogleDriveLogo size={28} />
              {driveBusy ? '読み込み中...' : 'Google ドライブ'}
            </button>

          </div>{/* 右カラム閉じ */}
        </div>{/* columns閉じ */}
      </div>

      {/* ドライブのファイル選択（アプリ内で完結する） */}
      {pickerOpen && (
        <GoogleDrivePicker onSelect={loadFromDrive} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

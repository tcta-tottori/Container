'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { getRecentFiles, base64ToFile, RecentFile } from '@/lib/recentFiles';

/** 判別されたファイルの役割 */
export type FileRole = 'container' | 'master' | 'ketaka' | 'container_schedule' | 'aqss04l' | 'aqss05l' | 'jkp' | 'unknown';

export interface ClassifiedFile {
  file: File;
  role: FileRole;
  label: string;
}

/** ファイル名からロールを自動判別 */
export function classifyFile(name: string): { role: FileRole; label: string } {
  const upper = name.toUpperCase();
  if (upper.includes('CNS_品目一覧') || upper.includes('CNS_品目') || upper.includes('全集約版')) {
    return { role: 'master', label: 'マスターデータ' };
  }
  if (upper.includes('气高出货') || upper.includes('気高出荷')) {
    return { role: 'ketaka', label: '气高编号マッピング' };
  }
  if (upper.includes('コンテナ日程')) {
    return { role: 'container_schedule', label: 'コンテナ日程' };
  }
  if (upper.startsWith('AQSS04L') || upper.includes('AQSS04L')) {
    return { role: 'aqss04l', label: 'AQSS04L (Invoice)' };
  }
  if (upper.startsWith('AQSS05L') || upper.includes('AQSS05L')) {
    return { role: 'aqss05l', label: 'AQSS05L (Packing)' };
  }
  if (upper.includes('JKP')) {
    return { role: 'jkp', label: 'JKP出荷スケジュール' };
  }
  // デフォルト: コンテナ日程（内容シート含む作業ファイル）
  return { role: 'container', label: 'コンテナ作業ファイル' };
}

interface FileDropZoneProps {
  onFileLoaded: (file: File) => void;
  onAqssLoaded?: (files: File[]) => void;
  onJkpLoaded?: (file: File) => void;
  onMultiFilesLoaded?: (classified: ClassifiedFile[]) => void;
}

const APP_VERSION = '1.4';
const CHANGELOG = [
  { ver: '1.4', date: '2026-03-24', changes: [
    { icon: '🔄', text: '統合ドロップゾーン（全ファイル自動判別）' },
    { icon: '🍲', text: 'JKP出荷予定表示（日付範囲指定）' },
    { icon: '📂', text: '更新履歴管理（過去5件・DL対応）' },
    { icon: '✨', text: 'ヤーマン部品タイプ追加（3YM/23F）' },
    { icon: '📊', text: 'コンテナトラック種類分布アニメーション' },
    { icon: '🎨', text: '半透明3D箱イメージ・パレット図レイアウト改善' },
    { icon: '🔊', text: 'CT切り上げ表示・検査控除修正・類似品判定改善' },
  ]},
  { ver: '1.3', date: '2026-03-24', changes: [
    { icon: '📦', text: 'CNS品目一覧を自動読込（管理ページ即反映）' },
    { icon: '✨', text: 'AQSS04L/05Lファイル読込対応' },
    { icon: '🔄', text: 'ドラッグ＆ドロップを統合（コンテナ+AQSS）' },
    { icon: '🎨', text: 'アニメーショングラデーション背景' },
    { icon: '📦', text: 'マニュアルページ追加（3タブ構成）' },
  ]},
  { ver: '1.2', date: '2026-03-24', changes: [
    { icon: '✨', text: 'コンテナ概要アナウンス（自動+手動コール）' },
    { icon: '📦', text: 'OKコマンドでパレット消費→自動完了' },
    { icon: '🎨', text: '類似品に理由表示（色違い/品名類似）' },
    { icon: '🔄', text: 'KTE/KEN表記でコード表示改善' },
    { icon: '🎨', text: 'リスト・枠外カラーをメニュー色に統一' },
  ]},
  { ver: '1.1', date: '2026-03-24', changes: [
    { icon: '📦', text: '管理ページ（Import/Export・全集約版対応）' },
    { icon: '✨', text: 'CN優先ソート・新建高コード' },
    { icon: '🎨', text: 'ダークテーマ統一・PL/CT表記' },
    { icon: '🔄', text: '音声コマンド拡充（11種）' },
  ]},
  { ver: '1.0', date: '2026-03-24', changes: [
    { icon: '✨', text: 'ジャーポット専用パレット図' },
    { icon: '📦', text: '品目合算・音声認識・自動読み上げ' },
    { icon: '🎨', text: 'ダーク背景ヒーロー・最近のファイル' },
  ]},
];

/* ===== CNSロゴSVG（段ボール箱・正方形に見えるアイソメトリック） ===== */
function CnsLogo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}>
      {/* ワイヤーフレームキューブ */}
      <g transform="translate(36,30)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinejoin="round" fill="none">
        <polygon points="0,-18 19,-9 0,1 -19,-9"/>
        <polygon points="-19,-9 0,1 0,21 -19,11"/>
        <polygon points="19,-9 0,1 0,21 19,11"/>
      </g>
      {/* 矢印 */}
      <g stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M17,30 L9,30"/>
        <polyline points="13,26 9,30 13,34"/>
      </g>
    </svg>
  );
}

export default function FileDropZone({ onFileLoaded, onAqssLoaded, onJkpLoaded, onMultiFilesLoaded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  // ファイル名で自動判別・振り分け
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const classified: ClassifiedFile[] = [];
      const aqssFiles: File[] = [];
      let containerFile: File | null = null;

      for (const f of Array.from(files)) {
        if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) continue;
        const { role, label } = classifyFile(f.name);
        classified.push({ file: f, role, label });

        if (role === 'aqss04l' || role === 'aqss05l') {
          aqssFiles.push(f);
        } else if (role === 'jkp') {
          if (onJkpLoaded) onJkpLoaded(f);
        } else if (role === 'container' || role === 'container_schedule') {
          // コンテナ作業ファイルとコンテナ日程は両方ともコンテナとして読込
          containerFile = f;
        }
        // master, ketaka は onMultiFilesLoaded 経由で処理
      }

      setClassifiedFiles(classified);

      if (onMultiFilesLoaded && classified.length > 0) {
        onMultiFilesLoaded(classified);
      }

      // コンテナファイルがあれば即読込・作業ページへ遷移
      if (containerFile) onFileLoaded(containerFile);
      if (aqssFiles.length > 0 && onAqssLoaded) onAqssLoaded(aqssFiles);
    },
    [onFileLoaded, onAqssLoaded, onJkpLoaded, onMultiFilesLoaded]
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const loadRecent = useCallback((entry: RecentFile) => {
    const file = base64ToFile(entry);
    // 最近のファイルも分類に基づいて適切なハンドラにルーティング
    const { role } = classifyFile(file.name);
    if (role === 'jkp') {
      if (onJkpLoaded) onJkpLoaded(file);
    } else {
      onFileLoaded(file);
    }
  }, [onFileLoaded, onJkpLoaded]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen"
      style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>

        {/* バージョン */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button onClick={() => setShowChangelog(true)}
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 20, padding: '5px 18px', cursor: 'pointer',
              color: '#a78bfa', fontSize: 12, fontFamily: 'var(--font-mono)',
              fontWeight: 700, letterSpacing: 0.8,
              boxShadow: '0 0 12px rgba(139,92,246,0.15)',
            }}>
            Ver {APP_VERSION}
          </button>
        </div>

        {/* バージョンポップアップ */}
        {showChangelog && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          }} onClick={() => setShowChangelog(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: 'linear-gradient(160deg, #1e2235 0%, #252a40 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '24px', width: '90%', maxWidth: 360,
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CnsLogo size={30} />
                  </div>
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0 }}>CNS</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, margin: 0 }}>Container Navigation System</p>
                  </div>
                </div>
                <button onClick={() => setShowChangelog(false)} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>✕</button>
              </div>
              {CHANGELOG.map((log) => (
                <div key={log.ver} style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                  padding: '14px 16px', marginBottom: 8,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 10px',
                      borderRadius: 12, fontFamily: 'var(--font-mono)',
                    }}>Ver {log.ver}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>{log.date}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {log.changes.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.5 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{c.icon}</span>
                        <span>{c.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 80, height: 80, borderRadius: 20,
            background: 'linear-gradient(135deg, #4f6ef7 0%, #9b6dfa 40%, #e06cf7 70%, #4f6ef7 100%)',
            backgroundSize: '300% 300%',
            animation: 'title-shimmer 6s ease-in-out infinite, logo-hue-shift 8s ease-in-out infinite',
            marginBottom: 12,
            boxShadow: '0 8px 32px rgba(79,110,247,0.4), 0 0 60px rgba(155,109,250,0.15)',
          }}>
            <CnsLogo size={64} />
          </div>
          <h1 style={{
            fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px', fontFamily: 'Inter, sans-serif',
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 40%, #f472b6 70%, #60a5fa 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'title-shimmer 4s ease-in-out infinite',
          }}>
            Container Navigation System
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 }}>
            コンテナ荷降ろし管理
          </p>
        </div>

        {/* 統合ドロップゾーン */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? '#3b82f6' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 16, padding: '24px 20px', textAlign: 'center', cursor: 'pointer',
            background: isDragging ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, margin: '0 auto 10px', borderRadius: 12,
            background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/>
            </svg>
          </div>
          <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>
            Excelファイルをドラッグ＆ドロップ
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 8px' }}>
            またはタップして選択（.xlsx / .xls）
          </p>
          {/* 対応ファイル説明 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[
              { label: 'コンテナ日程', color: '#60a5fa' },
              { label: '品目一覧', color: '#34d399' },
              { label: 'AQSS', color: '#a78bfa' },
              { label: 'JKP', color: '#f59e0b' },
              { label: '气高编号', color: '#f472b6' },
            ].map(({ label, color }) => (
              <span key={label} style={{
                fontSize: 9, color: `${color}cc`, background: `${color}15`,
                padding: '2px 6px', borderRadius: 4, border: `1px solid ${color}25`,
              }}>{label}</span>
            ))}
          </div>

          {/* 判別結果表示 */}
          {classifiedFiles.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {classifiedFiles.map((cf, i) => {
                const roleIcons: Record<FileRole, string> = {
                  container: '📋', master: '📊', ketaka: '🔗', container_schedule: '📅',
                  aqss04l: '📄', aqss05l: '📄', jkp: '🍲', unknown: '❓',
                };
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                    padding: '3px 8px', borderRadius: 6,
                    background: cf.role === 'unknown' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)',
                    border: cf.role === 'unknown' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(34,197,94,0.15)',
                  }}>
                    <span>{roleIcons[cf.role]}</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{cf.label}:</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cf.file.name}
                    </span>
                    <span style={{ color: cf.role === 'unknown' ? '#ef4444' : '#22c55e', fontSize: 12 }}>
                      {cf.role === 'unknown' ? '⚠' : '✓'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
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
                      {fmtDate(entry.date)} · {entry.containerCount}CN · {entry.itemCount}品目
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

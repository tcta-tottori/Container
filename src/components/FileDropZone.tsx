'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { getRecentFiles, base64ToFile, RecentFile, FileType } from '@/lib/recentFiles';
import { fetchMasterFileLastUpdate } from '@/lib/masterLoader';

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
  onAqssContainerLoaded?: (invoiceFile: File, packingFile?: File) => void;
  onJkpLoaded?: (file: File) => void;
  onMasterLoaded?: (file: File) => void;
  onMultiFilesLoaded?: (classified: ClassifiedFile[]) => void;
}

const APP_VERSION = '2.1';
const APP_UPDATED = process.env.NEXT_PUBLIC_BUILD_TIME || '---';
const CHANGELOG = [
  { ver: '2.0', date: '2026-03-26', changes: [
    { icon: '🎙️', text: '操作バー廃止→マイクボタン固定化（音声メイン操作）' },
    { icon: '🗣️', text: '音声コマンド拡充（お願いします/戻して/何種類?）' },
    { icon: '📦', text: 'パレット3D表示改善+端数パレット小表示+四隅積み' },
    { icon: '✨', text: '品目切替アニメーション（フェード+カウントアップ+ズーム）' },
    { icon: '📊', text: '積載分布ゲージ・@N表示・検査抜きCT表示' },
    { icon: '🔧', text: 'Meas.フォールバック+GitHub保存マージ+PWA更新通知' },
  ]},
  { ver: '1.9', date: '2026-03-26', changes: [
    { icon: '📦', text: 'パレット3D表示改善（3列×2行配置、JPI 7個/段）' },
    { icon: '📊', text: '積載分布ゲージ・進捗率表示' },
    { icon: '🎨', text: '読込ポップアップのグラデーションデザイン+プログレスバー' },
    { icon: '📡', text: 'GitHub保存マージ戦略（最新データを上書きしない）' },
  ]},
  { ver: '1.8', date: '2026-03-26', changes: [
    { icon: '🔧', text: '管理ページフィルター機能修正（初回クリックで選択表示）' },
    { icon: '📡', text: 'GitHub API経由でマスタデータ確実取得（トークン認証対応）' },
    { icon: '📦', text: 'JKP出荷スケジュールもGitHubから自動取得' },
    { icon: '🐛', text: 'サイズ列欠落による Meas./CBM データ消失バグ修正' },
    { icon: '🔄', text: '再読込ボタンでマスタ+JKP両方を最新に更新' },
    { icon: '🎨', text: 'アイコン・読込画面を青紫オレンジ乱雑グラデーションに統一' },
  ]},
  { ver: '1.7', date: '2026-03-25', changes: [
    { icon: '📦', text: 'パレット図CSS 3D化（箱積み/端数/回転対応）' },
    { icon: '🎨', text: '背景グラデーション一新（紫/青/オレンジ）' },
    { icon: '🏷️', text: 'ポリカバー箱シール位置を前面左上に修正' },
    { icon: '🔄', text: 'JPI 7個/段交互積みパターン実装' },
    { icon: '📂', text: 'JKPファイル最近のファイル保存・自動遷移修正' },
    { icon: '🎨', text: 'アイコンにネオングロー効果・鍋色を明るい赤に' },
  ]},
  { ver: '1.6', date: '2026-03-25', changes: [
    { icon: '🍲', text: 'JKPパーサー全面修正（N列=納入指示フィルタ対応）' },
    { icon: '📅', text: 'JKP日別コンテナ作成（タイガー鍋(3/25)形式）' },
    { icon: '📊', text: '進捗20%刻み詳細アナウンス（種類別残り内訳）' },
    { icon: '📈', text: '分析ページ種類別残り進捗バー表示' },
    { icon: '🎨', text: 'アイコン刷新（ワイヤーフレームキューブ+矢印）' },
    { icon: '📱', text: 'PWAアイコン・ファビコン統一、アプリ名CNS' },
  ]},
  { ver: '1.5', date: '2026-03-24', changes: [
    { icon: '📦', text: '管理ページ改善（GitHub自動保存・保存確認・フィルター）' },
    { icon: '🍲', text: 'JKP作業ページ・タイマー・パレット操作改善' },
    { icon: '📊', text: 'ジャーポットPDZ 2×2箱積み+ST段数表示' },
    { icon: '🎨', text: '類似品アイコン表示・@配置変更・パレット図修正' },
    { icon: '✨', text: 'Excelフィルター/ソート機能、経過時間表示' },
  ]},
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

export default function FileDropZone({ onFileLoaded, onAqssLoaded, onAqssContainerLoaded, onJkpLoaded, onMasterLoaded, onMultiFilesLoaded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([]);
  const [masterLastUpdate, setMasterLastUpdate] = useState<{ date: string; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentFiles(getRecentFiles());
    // マスタファイルの最終更新情報を取得
    fetchMasterFileLastUpdate().then((info) => {
      if (info) setMasterLastUpdate(info);
    });
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
        } else if (role === 'master') {
          // マスターデータ（CNS品目一覧）→ 直接読込・反映
          if (onMasterLoaded) onMasterLoaded(f);
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
        // コンテナファイルと同時にAQSSがあれば既存データ補完
        if (aqssFiles.length > 0 && onAqssLoaded) onAqssLoaded(aqssFiles);
      } else if (aqssFiles.length > 0) {
        // AQSSファイルのみ → コンテナとして新規作成
        const inv = aqssFiles.find(f => f.name.toUpperCase().includes('AQSS04L'));
        const pk = aqssFiles.find(f => f.name.toUpperCase().includes('AQSS05L'));
        if (inv && onAqssContainerLoaded) {
          onAqssContainerLoaded(inv, pk);
        } else if (onAqssLoaded) {
          onAqssLoaded(aqssFiles);
        }
      }
    },
    [onFileLoaded, onAqssLoaded, onAqssContainerLoaded, onJkpLoaded, onMultiFilesLoaded]
  );

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const loadRecent = useCallback((entry: RecentFile) => {
    const file = base64ToFile(entry);
    const { role } = classifyFile(file.name);
    // fileType or role-based routing
    const ft = entry.fileType || (role === 'jkp' ? 'jkp' : role === 'aqss04l' || role === 'aqss05l' ? 'aqss' : 'container');
    if (ft === 'jkp') {
      if (onJkpLoaded) onJkpLoaded(file);
    } else if (ft === 'aqss') {
      if (onAqssContainerLoaded) onAqssContainerLoaded(file);
      else onFileLoaded(file);
    } else {
      onFileLoaded(file);
    }
  }, [onFileLoaded, onJkpLoaded, onAqssContainerLoaded]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const gradientStyle = 'linear-gradient(135deg, #4a7af7 0%, #6b52d4 35%, #9b45c9 65%, #c0549a 100%)';

  return (
    <div className="flex items-center justify-center h-screen w-screen"
      style={{ background: 'linear-gradient(160deg, #0c0a1d 0%, #141028 30%, #0e1225 70%, #0a0c1e 100%)', overflow: 'auto' }}>
      <div className="drop-zone-root" style={{ width: '100%', maxWidth: 800, padding: '0 20px' }}>

        {/* 横画面: 2カラム構成 */}
        <div className="drop-zone-columns">
          {/* 左カラム: ロゴ+タイトル+バージョン */}
          <div className="drop-zone-left">
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <button onClick={() => setShowChangelog(true)}
            className="ver-badge-shimmer"
            style={{
              position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(74,122,247,0.2), rgba(155,69,201,0.2))',
              border: '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: 20, padding: '6px 22px', cursor: 'pointer',
              color: '#fff', fontSize: 13, fontFamily: 'var(--font-mono)',
              fontWeight: 800, letterSpacing: 1,
              textShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4), 0 0 40px rgba(107,82,212,0.3)',
              boxShadow: '0 0 20px rgba(107,82,212,0.25), 0 0 40px rgba(74,122,247,0.1)',
            }}>
            Ver {APP_VERSION}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9, marginTop: 5, fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
            Updated: {APP_UPDATED}
          </p>
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

          {/* 右カラム: ドロップゾーン+マスタ情報+最近のファイル */}
          <div className="drop-zone-right">

        {/* ドロップゾーン */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'rgba(107,82,212,0.6)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 16, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
            background: isDragging ? 'rgba(107,82,212,0.06)' : 'rgba(255,255,255,0.02)',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{
            width: 40, height: 40, margin: '0 auto 8px', borderRadius: 10,
            background: 'rgba(107,82,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9b7ae8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/>
            </svg>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
            Excelファイルをドラッグ＆ドロップ
          </p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: '0 0 10px' }}>
            またはタップして選択（.xlsx / .xls）
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
            {[
              { label: 'コンテナ日程', color: '#60a5fa' },
              { label: '品目一覧', color: '#34d399' },
              { label: 'AQSS', color: '#a78bfa' },
              { label: 'JKP', color: '#f59e0b' },
              { label: '气高编号', color: '#f472b6' },
            ].map(({ label, color }) => (
              <span key={label} style={{
                fontSize: 9, color, background: `${color}12`,
                padding: '2px 8px', borderRadius: 10, border: `1px solid ${color}20`,
                fontWeight: 500,
              }}>{label}</span>
            ))}
          </div>
          {classifiedFiles.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {classifiedFiles.map((cf, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 10,
                  padding: '4px 8px', borderRadius: 8,
                  background: cf.role === 'unknown' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.06)',
                }}>
                  <span style={{ color: cf.role === 'unknown' ? '#ef4444' : '#22c55e', fontSize: 11 }}>
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
          <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
            className="hidden" />
        </div>

        {/* マスタファイル最終更新情報 */}
        {masterLastUpdate && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 10,
            background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 1 }}>
                CNS_品目一覧_全集約版.xlsx
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                更新: {(() => {
                  const d = new Date(masterLastUpdate.date);
                  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                })()}
                {' · '}
                {masterLastUpdate.message.split('\n')[0]}
              </div>
            </div>
          </div>
        )}

        {/* 最近のファイル */}
        {recentFiles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>
              最近のファイル
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentFiles.map((entry) => {
                const ft: FileType = entry.fileType || (classifyFile(entry.name).role === 'jkp' ? 'jkp' : classifyFile(entry.name).role === 'master' ? 'master' : classifyFile(entry.name).role.startsWith('aqss') ? 'aqss' : 'container');
                const typeLabel = ft === 'jkp' ? 'JKP' : ft === 'aqss' ? 'AQSS' : ft === 'master' ? 'マスタ' : 'CN';
                const typeColor = ft === 'jkp' ? '#f97316' : ft === 'aqss' ? '#8b5cf6' : ft === 'master' ? '#34d399' : '#60a5fa';
                const infoText = ft === 'jkp'
                  ? `${entry.itemCount}品目`
                  : ft === 'master'
                  ? `${entry.itemCount}品目`
                  : `${entry.containerCount}CN · ${entry.itemCount}品目`;
                return (
                  <button key={entry.name + entry.date} onClick={() => loadRecent(entry)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      border: `1px solid rgba(255,255,255,0.06)`,
                      background: 'rgba(255,255,255,0.02)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  >
                    <span style={{
                      fontSize: 8, fontWeight: 800, color: typeColor,
                      background: `${typeColor}18`, padding: '3px 7px',
                      borderRadius: 6, fontFamily: 'var(--font-mono)', letterSpacing: 0.5,
                      flexShrink: 0, minWidth: 32, textAlign: 'center',
                    }}>{typeLabel}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{entry.name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, margin: '2px 0 0' }}>
                        {infoText}
                      </p>
                    </div>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {fmtDate(entry.date)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
          </div>{/* 右カラム閉じ */}
        </div>{/* columns閉じ */}
      </div>
    </div>
  );
}

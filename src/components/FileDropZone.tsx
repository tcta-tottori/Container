'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { getRecentFiles, base64ToFile, RecentFile, FileType } from '@/lib/recentFiles';
import { fetchMasterFileLastUpdate } from '@/lib/masterLoader';
import { getStoredToken } from '@/lib/githubSave';
import { openGooglePicker, downloadFromDrive } from '@/lib/googleDrive';

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

const APP_VERSION = '2.2';
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
  const [showHistory, setShowHistory] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [ghFiles, setGhFiles] = useState<{ name: string; sha: string; download_url: string }[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const fetchGitHubXlsxFiles = useCallback(async () => {
    setGhLoading(true);
    try {
      const token = getStoredToken() || process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';
      const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `token ${token}`;
      const res = await fetch(
        `https://api.github.com/repos/tcta-tottori/Container/contents/?ref=main&t=${Date.now()}`,
        { headers, cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        const xlsxFiles = (data as { name: string; sha: string; download_url: string }[])
          .filter((f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
        setGhFiles(xlsxFiles);
      }
    } catch (e) {
      console.warn('[GitHub] list files error', e);
    } finally {
      setGhLoading(false);
    }
  }, []);

  const loadGitHubFile = useCallback(async (fileName: string) => {
    setShowGitHub(false);
    try {
      const token = getStoredToken() || process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';
      const headers: Record<string, string> = { Accept: 'application/vnd.github.v3.raw' };
      if (token) headers['Authorization'] = `token ${token}`;
      const res = await fetch(
        `https://api.github.com/repos/tcta-tottori/Container/contents/${encodeURIComponent(fileName)}?ref=main&t=${Date.now()}`,
        { headers, cache: 'no-store' }
      );
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const file = new File([buffer], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        handleFiles([file]);
      }
    } catch (e) {
      console.warn('[GitHub] download file error', e);
    }
  }, [handleFiles]);

  const gradientStyle = 'linear-gradient(135deg, #4a7af7 0%, #6b52d4 35%, #9b45c9 65%, #c0549a 100%)';

  return (
    <div className="filedrop-root flex items-center justify-center h-screen w-screen"
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

        {/* マスタファイル最終更新情報 (hidden) */}

        {/* ===== ボタン行: [Google ドライブ] [GitHub] [履歴] ===== */}
        <div style={{
          marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {/* Google ドライブ ボタン (styled pill) */}
          <button
            onClick={async () => {
              try {
                const picked = await openGooglePicker();
                if (!picked || picked.length === 0) return;
                const files: File[] = [];
                for (const p of picked) {
                  const file = await downloadFromDrive(p.id, p.name);
                  files.push(file);
                }
                handleFiles(files);
              } catch (err) {
                console.error('Google Drive error:', err);
              }
            }}
            className="cns-action-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 50,
              background: 'linear-gradient(135deg, rgba(66,133,244,0.25) 0%, rgba(107,82,212,0.25) 50%, rgba(155,69,201,0.25) 100%)',
              border: '1.5px solid rgba(66,133,244,0.35)',
              cursor: 'pointer', transition: 'all 0.3s ease',
              color: '#8ab4ff', fontSize: 12, fontWeight: 700,
              boxShadow: '0 0 16px rgba(66,133,244,0.15), 0 0 32px rgba(107,82,212,0.08)',
              textShadow: '0 0 12px rgba(138,180,255,0.5)',
              letterSpacing: 0.3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66,133,244,0.4) 0%, rgba(107,82,212,0.4) 50%, rgba(155,69,201,0.4) 100%)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(66,133,244,0.3), 0 0 48px rgba(107,82,212,0.15)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(66,133,244,0.25) 0%, rgba(107,82,212,0.25) 50%, rgba(155,69,201,0.25) 100%)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(66,133,244,0.15), 0 0 32px rgba(107,82,212,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M7.71 3.5L1.15 15l3.43 5.99L11.14 9.5z" fill="#4285F4"/>
              <path d="M16.29 3.5H7.71l6.57 11.5h8.57z" fill="#00AC47"/>
              <path d="M22.85 15H14.28l-3.43 6h8.57z" fill="#EA4335"/>
            </svg>
            Google ドライブ
          </button>

          {/* GitHub ボタン */}
          <button
            onClick={() => { setShowGitHub(true); fetchGitHubXlsxFiles(); }}
            className="cns-action-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 50,
              background: 'linear-gradient(135deg, rgba(155,69,201,0.2) 0%, rgba(192,84,154,0.2) 50%, rgba(245,158,11,0.15) 100%)',
              border: '1.5px solid rgba(155,69,201,0.35)',
              cursor: 'pointer', transition: 'all 0.3s ease',
              color: '#c89aff', fontSize: 12, fontWeight: 700,
              boxShadow: '0 0 16px rgba(155,69,201,0.12), 0 0 32px rgba(192,84,154,0.06)',
              textShadow: '0 0 12px rgba(200,154,255,0.5)',
              letterSpacing: 0.3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155,69,201,0.35) 0%, rgba(192,84,154,0.35) 50%, rgba(245,158,11,0.25) 100%)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(155,69,201,0.25), 0 0 48px rgba(192,84,154,0.12)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155,69,201,0.2) 0%, rgba(192,84,154,0.2) 50%, rgba(245,158,11,0.15) 100%)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(155,69,201,0.12), 0 0 32px rgba(192,84,154,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>

          {/* 履歴ボタン */}
          <button
            onClick={() => setShowHistory(true)}
            className="cns-action-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 20px', borderRadius: 50,
              background: 'linear-gradient(135deg, rgba(96,165,250,0.2) 0%, rgba(52,211,153,0.15) 100%)',
              border: '1.5px solid rgba(96,165,250,0.3)',
              cursor: 'pointer', transition: 'all 0.3s ease',
              color: '#7dd3fc', fontSize: 12, fontWeight: 700,
              boxShadow: '0 0 16px rgba(96,165,250,0.12), 0 0 32px rgba(52,211,153,0.06)',
              textShadow: '0 0 12px rgba(125,211,252,0.5)',
              letterSpacing: 0.3,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(96,165,250,0.35) 0%, rgba(52,211,153,0.25) 100%)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(96,165,250,0.25), 0 0 48px rgba(52,211,153,0.12)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(96,165,250,0.2) 0%, rgba(52,211,153,0.15) 100%)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(96,165,250,0.12), 0 0 32px rgba(52,211,153,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            履歴
            {recentFiles.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800, background: 'rgba(96,165,250,0.3)',
                padding: '1px 6px', borderRadius: 10, marginLeft: -2,
              }}>{recentFiles.length}</span>
            )}
          </button>
        </div>

        {/* ===== 履歴ポップアップ ===== */}
        {showHistory && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          }} onClick={() => setShowHistory(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: 'linear-gradient(160deg, #1e2235 0%, #252a40 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '24px', width: '90%', maxWidth: 400,
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>最近のファイル</span>
                </div>
                <button onClick={() => setShowHistory(false)} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>✕</button>
              </div>
              {recentFiles.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                  まだファイルがありません
                </p>
              ) : (
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
                      <button key={entry.name + entry.date} onClick={() => { setShowHistory(false); loadRecent(entry); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.03)',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
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
              )}
            </div>
          </div>
        )}

        {/* ===== GitHub ポップアップ ===== */}
        {showGitHub && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          }} onClick={() => setShowGitHub(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: 'linear-gradient(160deg, #1e2235 0%, #252a40 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20, padding: '24px', width: '90%', maxWidth: 400,
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#c89aff">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>GitHub Repository</span>
                </div>
                <button onClick={() => setShowGitHub(false)} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>✕</button>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 12 }}>
                tcta-tottori/Container - .xlsx ファイル一覧
              </p>
              {ghLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{
                    width: 24, height: 24, border: '2px solid rgba(200,154,255,0.2)',
                    borderTop: '2px solid #c89aff', borderRadius: '50%',
                    margin: '0 auto 8px', animation: 'spin 0.8s linear infinite',
                  }} />
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>読み込み中...</p>
                </div>
              ) : ghFiles.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                  Excelファイルが見つかりません
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ghFiles.map((gf) => (
                    <button key={gf.name} onClick={() => loadGitHubFile(gf.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(200,154,255,0.08)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    >
                      <span style={{
                        fontSize: 14, flexShrink: 0, filter: 'grayscale(0.3)',
                      }}>📊</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{gf.name}</p>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
          </div>{/* 右カラム閉じ */}
        </div>{/* columns閉じ */}
      </div>
    </div>
  );
}

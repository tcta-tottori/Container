'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { getRecentFiles, base64ToFile, RecentFile, FileType } from '@/lib/recentFiles';

/**
 * 読み込んだAQSS04L等の元ファイルを閲覧するモーダル
 * - localStorage(recentFiles)に保存された.xlsxをXLSXで再パースして表示
 * - スマートフォン向けに「カード表示」と「テーブル表示」を切替可能
 * - 複数シート対応・検索フィルタ付き
 */
interface SourceFilesViewerProps {
  open: boolean;
  onClose: () => void;
}

interface SheetData {
  name: string;
  rows: (string | number)[][];
}

export default function SourceFilesViewer({ open, onClose }: SourceFilesViewerProps) {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [selected, setSelected] = useState<RecentFile | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFiles(getRecentFiles());
    // 自動的にカード or テーブル表示の初期値を画面幅で決定
    if (typeof window !== 'undefined') {
      setViewMode(window.innerWidth < 600 ? 'card' : 'table');
    }
  }, [open]);

  // ファイルが選択されたらXLSXをパース
  useEffect(() => {
    if (!selected) {
      setSheets([]);
      setSheetIdx(0);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const file = base64ToFile(selected);
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const parsed: SheetData[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          if (!ws) return { name, rows: [] };
          // !refを再計算して取りこぼしを防ぐ
          const cellKeys = Object.keys(ws).filter(k => !k.startsWith('!'));
          if (cellKeys.length > 0) {
            let maxR = 0, maxC = 0;
            for (const k of cellKeys) {
              const d = XLSX.utils.decode_cell(k);
              if (d.r > maxR) maxR = d.r;
              if (d.c > maxC) maxC = d.c;
            }
            ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
          }
          const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });
          return { name, rows };
        });
        if (!cancelled) {
          setSheets(parsed);
          setSheetIdx(0);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '読込エラー');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const currentSheet = sheets[sheetIdx];

  // 検索フィルタ後の行
  const filteredRows = useMemo(() => {
    if (!currentSheet) return [];
    const q = search.trim().toLowerCase();
    if (!q) return currentSheet.rows;
    return currentSheet.rows.filter((row) =>
      row.some((c) => String(c ?? '').toLowerCase().includes(q))
    );
  }, [currentSheet, search]);

  // 列数を計算
  const colCount = useMemo(() => {
    if (!currentSheet) return 0;
    let max = 0;
    for (const r of currentSheet.rows) if (r.length > max) max = r.length;
    return max;
  }, [currentSheet]);

  if (!open) return null;

  const typeLabel = (ft?: FileType) =>
    ft === 'jkp' ? 'JKP' : ft === 'aqss' ? 'AQSS' : ft === 'master' ? 'マスタ' : ft === 'container' ? 'CN' : 'その他';
  const typeColor = (ft?: FileType) =>
    ft === 'jkp' ? '#f97316' : ft === 'aqss' ? '#8b5cf6' : ft === 'master' ? '#34d399' : ft === 'container' ? '#60a5fa' : '#94a3b8';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1e2235 0%, #252a40 100%)',
          width: '100%', maxWidth: 900,
          display: 'flex', flexDirection: 'column',
          color: '#fff',
        }}
      >
        {/* ヘッダー */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <button
            onClick={selected ? () => setSelected(null) : onClose}
            style={{
              width: 36, height: 36, minWidth: 36, borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700,
            }}
            title={selected ? '一覧に戻る' : '閉じる'}
          >
            {selected ? '‹' : '✕'}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
              {selected ? selected.name : '元ファイル閲覧'}
            </div>
            {selected && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                {typeLabel(selected.fileType)} · {sheets.length}シート
              </div>
            )}
          </div>
          {selected && (
            <button
              onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
              style={{
                padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)', color: '#fff',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
              title="表示切替"
            >
              {viewMode === 'card' ? '表' : 'カード'}
            </button>
          )}
        </div>

        {/* 本文 */}
        {!selected ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {files.length === 0 ? (
              <div style={{
                padding: '40px 16px', textAlign: 'center',
                color: 'rgba(255,255,255,0.4)', fontSize: 13,
              }}>
                読み込んだファイルがありません
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((f) => (
                  <button
                    key={f.name + f.date}
                    onClick={() => setSelected(f)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 14px', borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.05)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      color: '#fff',
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      background: `${typeColor(f.fileType)}cc`,
                      padding: '4px 9px', borderRadius: 8,
                      minWidth: 44, textAlign: 'center', flexShrink: 0,
                      fontFamily: 'var(--font-mono)', letterSpacing: 0.5,
                    }}>
                      {typeLabel(f.fileType)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                        {new Date(f.date).toLocaleString('ja-JP', {
                          month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                        {f.containerCount > 0 && ` · ${f.containerCount}CN`}
                        {f.itemCount > 0 && ` · ${f.itemCount}件`}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0,
                    }}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* シート切替＋検索 */}
            <div style={{
              padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
            }}>
              {sheets.length > 1 && (
                <div style={{
                  display: 'flex', gap: 6, overflowX: 'auto',
                  paddingBottom: 2,
                }}>
                  {sheets.map((s, i) => (
                    <button
                      key={s.name + i}
                      onClick={() => setSheetIdx(i)}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: i === sheetIdx ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.04)',
                        color: i === sheetIdx ? '#bfdbfe' : 'rgba(255,255,255,0.7)',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="検索（品番・品名など）"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.25)', color: '#fff',
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>

            {/* 内容 */}
            <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                  読込中...
                </div>
              ) : error ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#fca5a5', fontSize: 13 }}>
                  {error}
                </div>
              ) : !currentSheet || filteredRows.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                  {search ? '一致する行がありません' : 'データがありません'}
                </div>
              ) : viewMode === 'card' ? (
                <CardView rows={filteredRows} />
              ) : (
                <TableView rows={filteredRows} colCount={colCount} />
              )}
            </div>

            {/* フッター情報 */}
            <div style={{
              padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: 10, color: 'rgba(255,255,255,0.5)',
              display: 'flex', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <span>{filteredRows.length} / {currentSheet?.rows.length || 0} 行</span>
              <span>{colCount} 列</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ===== カード表示（スマホ向け） ===== */
function CardView({ rows }: { rows: (string | number)[][] }) {
  // ヘッダー行の検出: 空でないセルが多い最初の行
  const headerIdx = rows.findIndex((r) => r.filter((c) => String(c ?? '').trim()).length >= 2);
  const headers = headerIdx >= 0 ? rows[headerIdx].map((c) => String(c ?? '').trim()) : [];
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dataRows.map((row, rIdx) => {
        const nonEmpty = row.filter((c) => String(c ?? '').trim());
        if (nonEmpty.length === 0) return null;
        return (
          <div
            key={rIdx}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-mono)', marginBottom: 2,
            }}>
              行 {headerIdx >= 0 ? rIdx + headerIdx + 2 : rIdx + 1}
            </div>
            {row.map((cell, cIdx) => {
              const v = String(cell ?? '').trim();
              if (!v) return null;
              const label = headers[cIdx] || `列${cIdx + 1}`;
              return (
                <div
                  key={cIdx}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    fontSize: 12, lineHeight: 1.4,
                    paddingTop: 2, paddingBottom: 2,
                  }}
                >
                  <span style={{
                    color: 'rgba(255,255,255,0.5)',
                    minWidth: 90, maxWidth: 120, flexShrink: 0,
                    fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </span>
                  <span style={{
                    color: '#fff', flex: 1,
                    wordBreak: 'break-word',
                  }}>
                    {v}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ===== テーブル表示（横スクロール） ===== */
function TableView({ rows, colCount }: { rows: (string | number)[][]; colCount: number }) {
  return (
    <div style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{
        borderCollapse: 'collapse', fontSize: 11, color: '#fff',
        minWidth: '100%',
      }}>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} style={{
              background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}>
              <td style={{
                position: 'sticky', left: 0,
                background: rIdx % 2 === 0 ? '#21263c' : '#1e2235',
                padding: '6px 8px',
                fontSize: 9, color: 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--font-mono)', textAlign: 'right',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                minWidth: 36,
              }}>
                {rIdx + 1}
              </td>
              {Array.from({ length: colCount }).map((_, cIdx) => {
                const v = String(row[cIdx] ?? '').trim();
                return (
                  <td
                    key={cIdx}
                    style={{
                      padding: '6px 10px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      borderRight: '1px solid rgba(255,255,255,0.05)',
                      whiteSpace: 'nowrap',
                      maxWidth: 240,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    title={v}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

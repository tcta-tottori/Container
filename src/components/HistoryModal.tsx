'use client';

import { useEffect, useState } from 'react';
import { getRecentFiles, base64ToFile, RecentFile, FileType } from '@/lib/recentFiles';
import { classifyFile } from '@/lib/fileClassifier';
import HistoryPanel from '@/components/HistoryPanel';
import { ClockIcon, CloseIcon, FileIcon } from '@/components/AppIcons';

type Tab = 'recent' | 'update';

interface HistoryModalProps {
  onClose: () => void;
  /** 最近のファイルを選んだとき（File に復元して渡す） */
  onSelectRecent: (file: File, fileType: FileType) => void;
}

/** 最近のファイルと更新履歴をまとめて見るポップアップ（メニューの「履歴」から開く） */
export default function HistoryModal({ onClose, onSelectRecent }: HistoryModalProps) {
  const [tab, setTab] = useState<Tab>('recent');
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const pick = (entry: RecentFile) => {
    const file = base64ToFile(entry);
    const role = classifyFile(file.name).role;
    const ft: FileType = entry.fileType
      || (role === 'jkp' ? 'jkp' : role === 'master' ? 'master' : role.startsWith('aqss') ? 'aqss' : 'container');
    onClose();
    onSelectRecent(file, ft);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 210,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.18s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1e2235 0%, #252a40 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          width: '100%', maxWidth: 440,
          maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>
            <ClockIcon size={20} />
            履歴
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', gap: 6, margin: '14px 0 16px' }}>
          {([
            { id: 'recent' as Tab, label: '最近のファイル' },
            { id: 'update' as Tab, label: '更新履歴' },
          ]).map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  flex: 1, padding: '11px 6px', borderRadius: 12, cursor: 'pointer',
                  background: active ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize: 13, fontWeight: 700, transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'recent' ? (
            recentFiles.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                まだファイルがありません
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentFiles.map((entry) => {
                  const role = classifyFile(entry.name).role;
                  const ft: FileType = entry.fileType
                    || (role === 'jkp' ? 'jkp' : role === 'master' ? 'master' : role.startsWith('aqss') ? 'aqss' : 'container');
                  const typeLabel = ft === 'jkp' ? 'JKP' : ft === 'aqss' ? 'AQSS' : ft === 'master' ? 'マスタ' : 'CN';
                  const typeColor = ft === 'jkp' ? '#f97316' : ft === 'aqss' ? '#8b5cf6' : ft === 'master' ? '#34d399' : '#60a5fa';
                  const infoText = ft === 'jkp' || ft === 'master'
                    ? `${entry.itemCount}品目`
                    : `${entry.containerCount}CN · ${entry.itemCount}品目`;
                  return (
                    <button key={entry.name + entry.date} onClick={() => pick(entry)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 13px', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.06)',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    >
                      <span style={{
                        fontSize: 10, fontWeight: 800, color: '#fff',
                        background: `${typeColor}cc`, padding: '3px 8px',
                        borderRadius: 6, fontFamily: 'var(--font-mono)', letterSpacing: 0.5,
                        flexShrink: 0, minWidth: 34, textAlign: 'center',
                      }}>{typeLabel}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          color: '#fff', fontSize: 14, fontWeight: 700, margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{entry.name}</p>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '3px 0 0' }}>
                          {infoText}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {fmtDate(entry.date)}
                      </span>
                      <FileIcon size={14} style={{ color: 'rgba(255,255,255,0.25)' }} />
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <HistoryPanel />
          )}
        </div>
      </div>
    </div>
  );
}

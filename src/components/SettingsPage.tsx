'use client';

import { useState } from 'react';
import CallPhraseSettings from '@/components/CallPhraseSettings';
import WaterSoundPanel from '@/components/WaterSoundPanel';
import VoiceSettingsPanel from '@/components/VoiceSettingsPanel';
import { ChatIcon, DropletIcon, CameraIcon, SettingsIcon, CloseIcon, SpeakerIcon, RotateIcon, ExternalLinkIcon } from '@/components/AppIcons';
import ScreenSettings from '@/components/ScreenSettings';
import {
  getGeminiKey, setGeminiKey, clearGeminiKey,
  getGeminiModel, setGeminiModel, GEMINI_MODELS, verifyGeminiKey,
} from '@/lib/geminiApi';

/** 'call' は旧タブ名。音声タブに統合したので voice と同じ画面を開く */
export type SettingsTab = 'voice' | 'call' | 'water' | 'screen' | 'ai';

interface SettingsPageProps {
  onClose: () => void;
  /** 開いたときに選択しておくタブ */
  initialTab?: SettingsTab;
  /** コールの試聴。読み終わったら onDone を呼ぶ */
  onTestCall?: (phrase: string, onDone: () => void) => void;
}

/** Gemini API キーを取りに行く Google AI Studio のページ */
const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

/** 写真読込（Gemini API）の設定セクション */
function AiPhotoSettings() {
  const [keyDraft, setKeyDraft] = useState(() => getGeminiKey());
  const [modelDraft, setModelDraft] = useState(() => getGeminiModel());
  const [keySaved, setKeySaved] = useState(() => !!getGeminiKey());
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMsg, setTestMsg] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 現在の状態 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '12px 14px', borderRadius: 12,
        background: keySaved ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${keySaved ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>AI写真読込</div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
            コンテナ日程の写真から品目を読み取ります
          </div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
          padding: '4px 12px', borderRadius: 999,
          color: keySaved ? '#6ee7b7' : 'rgba(255,255,255,0.5)',
          background: keySaved ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${keySaved ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}`,
        }}>
          {keySaved ? 'ON' : 'OFF'}
        </span>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
        Google Gemini API を使って写真から高精度に品目を抽出します。<br />
        API キーは <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer"
          style={{ color: '#8ab4ff', textDecoration: 'underline' }}>Google AI Studio</a> で無料取得できます（Flash モデルは無料枠あり）。
      </p>

      {/* API キーの見出しの右に、取得ページ（AI Studio）へ飛ぶボタンを置く */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <label style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, flex: 1 }}>
          API キー
        </label>
        <a
          href={AI_STUDIO_URL}
          target="_blank"
          rel="noreferrer"
          title="Google AI Studio でAPIキーを取得"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 11px', borderRadius: 999,
            background: 'rgba(138,180,255,0.12)', border: '1px solid rgba(138,180,255,0.35)',
            color: '#8ab4ff', fontSize: 11.5, fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          <ExternalLinkIcon size={13} strokeWidth={2} />
          AI Studio でキーを取得
        </a>
      </div>
      <input
        type="password"
        value={keyDraft}
        onChange={(e) => setKeyDraft(e.target.value)}
        placeholder="AIza..."
        autoComplete="off"
        style={{
          width: '100%', padding: '11px 13px', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontSize: 14, fontFamily: 'var(--font-mono)',
          outline: 'none', boxSizing: 'border-box', marginBottom: 14,
        }}
      />

      <label style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 7 }}>
        モデル
      </label>
      <select
        value={modelDraft}
        onChange={(e) => setModelDraft(e.target.value)}
        style={{
          width: '100%', padding: '11px 13px', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          marginBottom: 16,
        }}
      >
        {GEMINI_MODELS.map((m) => (
          <option key={m.id} value={m.id} style={{ background: '#1e2235', color: '#fff' }}>
            {m.label} — {m.note}
          </option>
        ))}
      </select>

      {testState !== 'idle' && (
        <div style={{
          marginBottom: 14, padding: '9px 13px', borderRadius: 10, fontSize: 12,
          background: testState === 'ok' ? 'rgba(52,211,153,0.12)'
            : testState === 'fail' ? 'rgba(248,113,113,0.12)'
            : 'rgba(96,165,250,0.1)',
          color: testState === 'ok' ? '#6ee7b7'
            : testState === 'fail' ? '#fca5a5'
            : '#93c5fd',
          border: `1px solid ${testState === 'ok' ? 'rgba(52,211,153,0.25)'
            : testState === 'fail' ? 'rgba(248,113,113,0.25)'
            : 'rgba(96,165,250,0.2)'}`,
        }}>
          {testState === 'testing' ? '接続テスト中...' : testMsg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          onClick={async () => {
            if (!keyDraft.trim()) { setTestState('fail'); setTestMsg('APIキーを入力してください'); return; }
            setTestState('testing');
            try {
              const ok = await verifyGeminiKey(keyDraft.trim(), modelDraft);
              if (ok) { setTestState('ok'); setTestMsg('接続OK'); }
              else { setTestState('fail'); setTestMsg('APIキーが無効、またはモデル権限なし'); }
            } catch (e) {
              setTestState('fail');
              setTestMsg(`テスト失敗: ${e instanceof Error ? e.message : String(e)}`);
            }
          }}
          style={{
            flex: 1, padding: '12px', borderRadius: 10,
            background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.35)',
            color: '#93c5fd', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          接続テスト
        </button>
        <button
          onClick={() => {
            setGeminiKey(keyDraft.trim());
            setGeminiModel(modelDraft);
            setKeySaved(!!keyDraft.trim());
            setTestState('ok'); setTestMsg('保存しました');
          }}
          style={{
            flex: 1, padding: '12px', borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(96,165,250,0.3))',
            border: '1px solid rgba(52,211,153,0.4)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          保存
        </button>
      </div>

      <button
        onClick={() => {
          clearGeminiKey();
          setKeyDraft('');
          setKeySaved(false);
          setTestState('ok'); setTestMsg('キーを削除しました');
        }}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: 'transparent', border: '1px solid rgba(248,113,113,0.25)',
          color: '#fca5a5', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        保存済みキーを削除
      </button>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.6, marginTop: 14 }}>
        ※ キーはこの端末の localStorage にのみ保存されます。<br />
        ※ 未設定時は Tesseract.js によるローカル OCR（精度低）にフォールバックします。
      </p>
    </div>
  );
}

/*
 * 声とコール内容は一体で調整するもの（声を変えたらコールの試聴もその声で聴きたい）なので、
 * 別々のタブに分けず「音声・コール」ひとつにまとめている。
 */
const TABS: { id: SettingsTab; label: string; Icon: typeof ChatIcon }[] = [
  { id: 'voice', label: '音声・コール', Icon: SpeakerIcon },
  { id: 'water', label: '水の音', Icon: DropletIcon },
  { id: 'screen', label: '画面', Icon: RotateIcon },
  { id: 'ai', label: 'AI写真', Icon: CameraIcon },
];

/** 音声・コール・水の音・AI写真をまとめて設定するページ */
export default function SettingsPage({ onClose, initialTab = 'voice', onTestCall }: SettingsPageProps) {
  // 旧「コール」タブ指定で開かれても、統合後の音声タブを出す
  const [tab, setTab] = useState<SettingsTab>(initialTab === 'call' ? 'voice' : initialTab);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 210,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.18s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #0c0a1d 0%, #141028 50%, #0e1225 100%)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          borderRadius: 20, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          width: '100%', maxWidth: 460,
          maxHeight: '86vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>
            <SettingsIcon size={20} />
            設定
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
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '11px 4px', borderRadius: 12, cursor: 'pointer',
                  background: active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize: 12, fontWeight: 700, transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'voice' && (
            <>
              <VoiceSettingsPanel />
              {/* 声の設定に続けてコールの内容。声を変えたらすぐ下で試聴して確かめられる */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                margin: '22px 0 14px',
              }}>
                <ChatIcon size={16} />
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  コールの内容
                </span>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              </div>
              <CallPhraseSettings onTest={onTestCall} />
            </>
          )}
          {tab === 'water' && <WaterSoundPanel />}
          {tab === 'screen' && <ScreenSettings />}
          {tab === 'ai' && <AiPhotoSettings />}
        </div>
      </div>
    </div>
  );
}

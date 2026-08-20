'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VOICE_OPTIONS, TONE_PRESETS, DEFAULT_TTS_MODEL, DEFAULT_VOICE_SETTINGS,
  DEFAULT_SHERPA_BASE_URL,
  VoiceSettings, VoiceProfile, VoiceEngine,
  getVoiceSettings, saveVoiceSettings, styleInstruction, webSpeechVolume,
} from '@/lib/voiceSettings';
import {
  prepareSherpaTts, sherpaGenerateSpeech, clearSherpaCache,
  getSherpaState, subscribeSherpaState, SherpaState,
} from '@/lib/sherpaTts';
import { MAX_VOLUME, applyVolume, isBoostSupported } from '@/lib/audioBoost';
import { geminiGenerateSpeech, subscribeTtsError, getLastTtsError } from '@/lib/geminiTts';
import { getGeminiKey, setGeminiKey, verifyGeminiKey } from '@/lib/geminiApi';
import { loadCallPhrases, DEFAULT_CALL_PHRASES } from '@/lib/callPhrases';
import { ExternalLinkIcon } from '@/components/AppIcons';

type ProfileKey = 'main' | 'cheer';

const MAIN_SAMPLE = 'ポリカバー、3パレットと2ケース。';

/**
 * 試聴で読み上げる文。
 * 応援コールは、下の「コールの内容」に登録してあるものをそのまま使う。
 * 声を変えたときに、実際に鳴るコールで確かめられるようにするため。
 */
function sampleText(key: ProfileKey): string {
  if (key === 'main') return MAIN_SAMPLE;
  const phrases = loadCallPhrases();
  return phrases[0] || DEFAULT_CALL_PHRASES[0];
}

/** 見出し */
/** Gemini API キーを取りに行く Google AI Studio のページ */
const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

/** AI Studio（キーの取得ページ）へ飛ぶボタン */
function AiStudioLink() {
  return (
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
        textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      <ExternalLinkIcon size={13} strokeWidth={2} />
      AI Studio でキーを取得
    </a>
  );
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700 }}>{children}</div>
      {hint && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** 数値スライダー（速さ・高さ・音量） */
function Slider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700 }}>{label}</span>
        <span style={{ color: '#c4b5fd', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          {format(value)}
        </span>
      </div>
      <input
        className="voice-range"
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** コール・応援それぞれの話者／トーン設定 */
function ProfileEditor({
  profile, engine, canSample, onChange, onTest, testing,
}: {
  profile: VoiceProfile;
  engine: VoiceEngine;
  canSample: boolean;
  onChange: (p: VoiceProfile) => void;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <div>
      {/* 話者 */}
      <Label hint={
        engine === 'web' ? '端末の音声では話者を選べません（速さ・高さのみ反映）'
          : engine === 'sherpa' ? 'sherpa-onnx では下の「話者番号」で選びます'
            : undefined
      }>
        話す人（声）
      </Label>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 16,
        opacity: engine === 'gemini' ? 1 : 0.45,
      }}>
        {VOICE_OPTIONS.map((v) => {
          const active = profile.voice === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onChange({ ...profile, voice: v.id })}
              disabled={engine !== 'gemini'}
              style={{
                textAlign: 'left', padding: '9px 11px', borderRadius: 10,
                background: active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                color: '#fff', cursor: engine === 'web' ? 'default' : 'pointer',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>{v.label}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{v.gender}・{v.desc}</div>
            </button>
          );
        })}
      </div>

      {/* トーン */}
      <Label hint={engine === 'gemini'
        ? '読み上げ方の指示。カスタムでは自由に書けます'
        : 'トーンの指示は Gemini TTS だけに反映されます'}>
        トーン（話し方）
      </Label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {[...TONE_PRESETS, { id: 'custom', label: 'カスタム', style: '' }].map((t) => {
          const active = profile.tone === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange({ ...profile, tone: t.id })}
              style={{
                padding: '8px 14px', borderRadius: 999,
                background: active ? 'rgba(139,92,246,0.28)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {profile.tone === 'custom' && (
        <input
          type="text"
          value={profile.customStyle}
          onChange={(e) => onChange({ ...profile, customStyle: e.target.value })}
          placeholder="例: 低い声でゆっくり、落ち着いて読む"
          style={{
            width: '100%', padding: '11px 13px', borderRadius: 10, marginBottom: 12,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}
      <div style={{
        color: '#64748b', fontSize: 11, lineHeight: 1.6, marginBottom: 16,
        padding: '8px 11px', borderRadius: 9,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {engine === 'sherpa'
          ? 'sherpa-onnx では「話す速さ」と「話者番号」が反映されます（トーン・声の高さはモデル側で決まります）。'
          : `指示文: ${styleInstruction(profile)}`}
      </div>

      <Slider
        label="話す速さ" value={profile.rate} min={0.6} max={1.6} step={0.05}
        format={(v) => `${v.toFixed(2)}倍`}
        onChange={(v) => onChange({ ...profile, rate: v })}
      />
      <Slider
        label="声の高さ" value={profile.pitch} min={0.6} max={1.6} step={0.05}
        format={(v) => `${v.toFixed(2)}`}
        onChange={(v) => onChange({ ...profile, pitch: v })}
      />

      {engine === 'sherpa' && (
        <>
          <Label hint="複数話者のモデル（VITS など）のとき、どの声で読むかの番号。1人だけのモデルは 0 のまま">
            話者番号
          </Label>
          <input
            type="number"
            min={0}
            value={profile.sid}
            onChange={(e) => onChange({ ...profile, sid: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            style={{
              width: '100%', padding: '11px 13px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 14, fontFamily: 'var(--font-mono)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </>
      )}

      <button
        onClick={onTest}
        disabled={testing || !canSample}
        style={{
          width: '100%', padding: '13px', borderRadius: 12, marginTop: 4,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(74,110,247,0.25))',
          border: '1px solid rgba(167,139,250,0.5)',
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: testing || !canSample ? 'default' : 'pointer',
          opacity: testing || !canSample ? 0.55 : 1,
        }}
      >
        {testing ? '生成中...' : 'この声で試聴'}
      </button>
    </div>
  );
}

/** 音声コール（TTS）の設定セクション。設定ページの「音声」タブとして表示する */
export default function VoiceSettingsPanel() {
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());
  const [tab, setTab] = useState<ProfileKey>('main');
  const [keyDraft, setKeyDraft] = useState(() => getGeminiKey());
  const [keySaved, setKeySaved] = useState(() => !!getGeminiKey());
  const [apiState, setApiState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [apiMsg, setApiMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const detachRef = useRef<(() => void) | null>(null);
  // SSR とクライアントで初期描画をそろえるため、対応判定はマウント後に行う
  const [boostSupported, setBoostSupported] = useState(true);
  const [sherpa, setSherpa] = useState<SherpaState>(() => getSherpaState());

  useEffect(() => { setBoostSupported(isBoostSupported()); }, []);

  useEffect(() => {
    setSherpa(getSherpaState());
    return subscribeSherpaState(setSherpa);
  }, []);

  useEffect(() => {
    setTtsError(getLastTtsError());
    return subscribeTtsError(setTtsError);
  }, []);

  // パネルを閉じたら試聴を止める
  useEffect(() => () => {
    if (audioRef.current) { try { audioRef.current.pause(); } catch { /* ignore */ } }
    if (detachRef.current) { detachRef.current(); detachRef.current = null; }
    if (urlRef.current) { try { URL.revokeObjectURL(urlRef.current); } catch { /* ignore */ } }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const update = useCallback((next: VoiceSettings) => {
    setSettings(next);
    saveVoiceSettings(next);
  }, []);

  const playTest = useCallback(async (key: ProfileKey) => {
    const profile = settings[key];
    const text = sampleText(key);
    if (audioRef.current) { try { audioRef.current.pause(); } catch { /* ignore */ } audioRef.current = null; }
    if (detachRef.current) { detachRef.current(); detachRef.current = null; }
    if (urlRef.current) { try { URL.revokeObjectURL(urlRef.current); } catch { /* ignore */ } urlRef.current = null; }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();

    if (settings.engine === 'web') {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = Math.min(2, Math.max(0.5, profile.rate * 1.1));
      u.pitch = Math.min(2, Math.max(0, profile.pitch));
      u.volume = webSpeechVolume(settings);
      window.speechSynthesis.speak(u);
      return;
    }

    setTesting(true);
    try {
      const blob = settings.engine === 'sherpa'
        ? await sherpaGenerateSpeech(text, { sid: profile.sid, speed: profile.rate })
        : await geminiGenerateSpeech(text, {
          voice: profile.voice,
          model: settings.model,
          stylePrefix: styleInstruction(profile),
        });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const detach = await applyVolume(audio, settings.volume);
      audioRef.current = audio;
      urlRef.current = url;
      detachRef.current = detach;
      const cleanup = () => {
        detach();
        if (detachRef.current === detach) detachRef.current = null;
        if (urlRef.current === url) { URL.revokeObjectURL(url); urlRef.current = null; }
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    } catch (e) {
      console.error('試聴に失敗:', e);
    } finally {
      setTesting(false);
    }
  }, [settings]);

  const canSample = settings.engine === 'web' || settings.engine === 'sherpa' || keySaved;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .voice-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,0.15); outline: none;
        }
        .voice-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 24px; height: 24px; border-radius: 50%;
          background: linear-gradient(135deg, #a78bfa, #6366f1);
          border: 1px solid rgba(255,255,255,0.5); cursor: pointer;
        }
        .voice-range::-moz-range-thumb {
          width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.5);
          background: linear-gradient(135deg, #a78bfa, #6366f1); cursor: pointer;
        }
      `}</style>

      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
        コールに使う音声 API・話す人・トーン・速さをここでまとめて設定します。
      </div>

      {/* ===== 音声 API ===== */}
      <Label hint="Gemini TTS は高品質（通信あり）。sherpa-onnx は端末内で高音質・通信なし。端末の音声は準備不要">音声 API</Label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([
          { id: 'gemini' as VoiceEngine, label: 'Gemini TTS' },
          { id: 'sherpa' as VoiceEngine, label: 'sherpa-onnx' },
          { id: 'web' as VoiceEngine, label: '端末の音声' },
        ]).map(({ id, label }) => {
          const active = settings.engine === id;
          return (
            <button
              key={id}
              onClick={() => update({ ...settings, engine: id })}
              style={{
                flex: 1, padding: '12px 6px', borderRadius: 12,
                background: active ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(167,139,250,0.55)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {settings.engine === 'gemini' && (
        <>
          {/* キー欄のすぐ上に、取得ページ（AI Studio）へ飛ぶボタンを並べる */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Label hint="AI写真の設定と共通のキーです">Gemini API キー</Label>
            </div>
            <AiStudioLink />
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
              outline: 'none', boxSizing: 'border-box', marginBottom: 10,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={async () => {
                if (!keyDraft.trim()) { setApiState('fail'); setApiMsg('APIキーを入力してください'); return; }
                setApiState('testing');
                try {
                  const ok = await verifyGeminiKey(keyDraft.trim());
                  if (ok) { setApiState('ok'); setApiMsg('接続OK'); }
                  else { setApiState('fail'); setApiMsg('APIキーが無効です'); }
                } catch (e) {
                  setApiState('fail');
                  setApiMsg(`テスト失敗: ${e instanceof Error ? e.message : String(e)}`);
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
                setKeySaved(!!keyDraft.trim());
                setApiState('ok'); setApiMsg('保存しました');
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
          {apiState !== 'idle' && (
            <div style={{
              marginBottom: 12, padding: '9px 13px', borderRadius: 10, fontSize: 12,
              background: apiState === 'ok' ? 'rgba(52,211,153,0.12)'
                : apiState === 'fail' ? 'rgba(248,113,113,0.12)' : 'rgba(96,165,250,0.1)',
              color: apiState === 'ok' ? '#6ee7b7' : apiState === 'fail' ? '#fca5a5' : '#93c5fd',
              border: `1px solid ${apiState === 'ok' ? 'rgba(52,211,153,0.25)'
                : apiState === 'fail' ? 'rgba(248,113,113,0.25)' : 'rgba(96,165,250,0.2)'}`,
            }}>
              {apiState === 'testing' ? '接続テスト中...' : apiMsg}
            </div>
          )}

          <Label hint="他のモデルを試すときはここに入力します">TTS モデル</Label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => update({ ...settings, model: e.target.value })}
              placeholder={DEFAULT_TTS_MODEL}
              style={{
                flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 10,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            <button
              onClick={() => update({ ...settings, model: DEFAULT_TTS_MODEL })}
              style={{
                padding: '11px 14px', borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              }}
            >
              初期値
            </button>
          </div>

          {ttsError && (
            <div style={{
              color: '#fca5a5', fontSize: 11, lineHeight: 1.6, marginBottom: 14,
              padding: '9px 12px', borderRadius: 10, wordBreak: 'break-all',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>直近の TTS エラー</div>
              {ttsError}
            </div>
          )}
        </>
      )}

      {settings.engine === 'sherpa' && (
        <>
          <Label hint="sherpa-onnx の WebAssembly 一式（.js / .wasm / .data）を置いた場所。既定はアプリ内の sherpa/ フォルダ">
            モデルの置き場所
          </Label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input
              type="text"
              value={settings.sherpa.baseUrl}
              onChange={(e) => update({ ...settings, sherpa: { ...settings.sherpa, baseUrl: e.target.value } })}
              placeholder={DEFAULT_SHERPA_BASE_URL}
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 10,
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
            <button
              onClick={() => update({ ...settings, sherpa: { ...settings.sherpa, baseUrl: DEFAULT_SHERPA_BASE_URL } })}
              style={{
                padding: '11px 14px', borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              }}
            >
              初期値
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => { void prepareSherpaTts(true).catch(() => { /* 状態は下に出る */ }); }}
              disabled={sherpa.status === 'loading'}
              style={{
                flex: 1, padding: '12px', borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(96,165,250,0.3))',
                border: '1px solid rgba(52,211,153,0.4)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: sherpa.status === 'loading' ? 'default' : 'pointer',
                opacity: sherpa.status === 'loading' ? 0.6 : 1,
              }}
            >
              {sherpa.status === 'loading' ? '読み込み中...' : 'モデルを準備する'}
            </button>
            <button
              onClick={() => { void clearSherpaCache(); }}
              style={{
                padding: '12px 14px', borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              }}
            >
              保存分を削除
            </button>
          </div>

          {/* 読み込みの進み具合・状態 */}
          {sherpa.status === 'loading' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                height: 6, borderRadius: 999, overflow: 'hidden',
                background: 'rgba(255,255,255,0.1)',
              }}>
                <div style={{
                  width: `${Math.round(sherpa.progress * 100)}%`, height: '100%',
                  background: 'linear-gradient(90deg, #8b5cf6, #4a6ef7)', transition: 'width 0.2s ease',
                }} />
              </div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 5 }}>
                {sherpa.message}（{Math.round(sherpa.progress * 100)}%）
              </div>
            </div>
          )}
          {sherpa.status === 'ready' && (
            <div style={{
              marginBottom: 12, padding: '9px 13px', borderRadius: 10, fontSize: 12,
              background: 'rgba(52,211,153,0.12)', color: '#6ee7b7',
              border: '1px solid rgba(52,211,153,0.25)',
            }}>
              準備できました（話者{sherpa.numSpeakers}人）。この端末では通信なしでコールできます。
            </div>
          )}
          {sherpa.status === 'error' && sherpa.error && (
            <div style={{
              color: '#fca5a5', fontSize: 11, lineHeight: 1.6, marginBottom: 12,
              padding: '9px 12px', borderRadius: 10, wordBreak: 'break-all',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>まだ使えません</div>
              {sherpa.error}
            </div>
          )}

          {/* 起動時に読み込むか */}
          <div
            onClick={() => update({ ...settings, sherpa: { ...settings.sherpa, preload: !settings.sherpa.preload } })}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '12px 14px', marginBottom: 14, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>アプリを開いたら先に読み込む</div>
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
                最初のコールを待たずに鳴らせます
              </div>
            </div>
            <div style={{
              width: 44, height: 26, borderRadius: 999, flexShrink: 0,
              background: settings.sherpa.preload ? 'linear-gradient(135deg, #8b5cf6, #4a6ef7)' : 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.15)', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: settings.sherpa.preload ? 20 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.15s ease',
              }} />
            </div>
          </div>

          <div style={{
            color: '#64748b', fontSize: 11, lineHeight: 1.7, marginBottom: 16,
            padding: '9px 12px', borderRadius: 9,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            sherpa-onnx（Next-gen Kaldi・Apache-2.0）を端末の中で動かします。VITS / Piper / Kokoro などの
            日本語モデルを ONNX のまま読み上げるので、通信なしでも自然な抑揚でコールできます。<br />
            置き場所に次の4ファイルを入れてください。<br />
            <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
              sherpa-onnx-wasm-main-tts.js / .wasm / .data、sherpa-onnx-tts.js
            </span><br />
            一度読み込んだファイルは端末に残るので、2回目からは圏外でも鳴ります。
          </div>
        </>
      )}

      <Slider
        label="音量" value={settings.volume} min={0} max={MAX_VOLUME} step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ ...settings, volume: v })}
      />
      <div style={{
        color: '#64748b', fontSize: 11, lineHeight: 1.6, marginBottom: 16,
        padding: '8px 11px', borderRadius: 9,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      }}>
        100% は端末の音量そのまま。それ以上はコールを増幅して鳴らす（最大 300%。端末の音声を除く）。
        {settings.engine === 'web' && (
          <>
            <br />
            端末の音声はブラウザの仕様で 100% が上限です。もっと大きくしたいときは
            Gemini TTS か sherpa-onnx に切り替えるか、端末側のメディア音量を上げてください。
          </>
        )}
        {settings.engine !== 'web' && !boostSupported && (
          <>
            <br />
            この端末は増幅に対応していないため 100% が上限になります。
          </>
        )}
      </div>

      {/* ===== コール別プロファイル ===== */}
      <div style={{
        height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 0 16px',
      }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([
          { id: 'main' as ProfileKey, label: '通常コール' },
          { id: 'cheer' as ProfileKey, label: '応援コール' },
        ]).map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: '11px 8px', borderRadius: 12,
                background: active ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <ProfileEditor
        profile={settings[tab]}
        engine={settings.engine}
        canSample={canSample}
        testing={testing}
        onChange={(p) => update({ ...settings, [tab]: p })}
        onTest={() => void playTest(tab)}
      />

      <button
        onClick={() => update({ ...DEFAULT_VOICE_SETTINGS })}
        style={{
          marginTop: 14, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#94a3b8', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        音声設定を初期値に戻す
      </button>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.6, marginTop: 12 }}>
        ※ 通常コールは品名・残数・進捗などの読み上げ、応援コールは応援ボタンと定期コールの応援に使います。<br />
        ※ Gemini TTS はコールのたびに通信します。圏外や API エラーのときは音が出ないため、
        その場合は「sherpa-onnx」か「端末の音声」に切り替えてください。<br />
        ※ sherpa-onnx は最初にモデルを読み込むと、そのあとは通信なしでコールできます。
        モデルが見つからないときは自動で端末の音声に切り替えて鳴らします。
      </p>
    </div>
  );
}

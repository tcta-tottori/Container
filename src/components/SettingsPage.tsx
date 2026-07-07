'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCheerPhrases, setCheerPhrases, resetCheerPhrases,
  getTauntPhrases, setTauntPhrases, resetTauntPhrases,
  getCustomVoices, setCustomVoices, getAllVoices,
  getTauntVoice, setTauntVoice, getCheerVoice, setCheerVoice,
} from '@/lib/callSettings';
import { GEMINI_VOICES, type GeminiVoice, geminiGenerateSpeech, isGeminiTtsEnabled } from '@/lib/geminiTts';
import { getGeminiKey } from '@/lib/geminiApi';

// ── 共通スタイル ─────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
};
const sectionTitle: React.CSSProperties = {
  color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4,
};
const sectionDesc: React.CSSProperties = {
  color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 1.5, marginBottom: 12,
};
const input: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8,
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: 13, outline: 'none',
};
const smallBtn = (accent: string): React.CSSProperties => ({
  padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
  background: `${accent}22`, border: `1px solid ${accent}55`, color: accent,
});

/** フレーズ一覧の編集ブロック */
function PhraseEditor({
  title, desc, phrases, onChange, onReset, onSample, playingIdx, loadingIdx, canSample,
}: {
  title: string;
  desc: string;
  phrases: string[];
  onChange: (list: string[]) => void;
  onReset: () => void;
  onSample: (text: string, idx: number) => void;
  playingIdx: number | null;
  loadingIdx: number | null;
  canSample: boolean;
}) {
  const [draft, setDraft] = useState('');

  const update = (i: number, val: string) => {
    const next = phrases.slice();
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(phrases.filter((_, idx) => idx !== i));
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...phrases, v]);
    setDraft('');
  };

  return (
    <div style={card}>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionDesc}>{desc}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {phrases.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              style={input}
              value={p}
              onChange={(e) => update(i, e.target.value)}
              placeholder="フレーズを入力"
            />
            {canSample && (
              <button
                onClick={() => onSample(p, i)}
                title="試聴"
                style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: playingIdx === i ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {loadingIdx === i ? '…' : playingIdx === i ? '■' : '▶'}
              </button>
            )}
            <button
              onClick={() => remove(i)}
              title="削除"
              style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5', cursor: 'pointer', fontSize: 16, lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
        {phrases.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: '4px 0' }}>
            フレーズがありません。下から追加してください。
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input
          style={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="新しいフレーズを追加"
        />
        <button onClick={add} style={smallBtn('#a78bfa')}>追加</button>
      </div>

      <button onClick={onReset} style={{ ...smallBtn('#94a3b8'), marginTop: 10 }}>
        初期フレーズに戻す
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [cheer, setCheer] = useState<string[]>([]);
  const [taunt, setTaunt] = useState<string[]>([]);
  const [allVoices, setAllVoices] = useState<GeminiVoice[]>([]);
  const [customVoices, setCustom] = useState<GeminiVoice[]>([]);
  const [tauntVoice, setTauntV] = useState<string>('');
  const [cheerVoice, setCheerV] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);

  // 新規カスタムボイス入力
  const [nvId, setNvId] = useState('');
  const [nvLabel, setNvLabel] = useState('');
  const [nvDesc, setNvDesc] = useState('');

  const refresh = useCallback(() => {
    setCheer(getCheerPhrases());
    setTaunt(getTauntPhrases());
    setAllVoices(getAllVoices());
    setCustom(getCustomVoices());
    setTauntV(getTauntVoice());
    setCheerV(getCheerVoice());
    setHasKey(!!getGeminiKey());
    setTtsOn(isGeminiTtsEnabled());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const canSample = hasKey && ttsOn;

  // ── サンプル再生管理 ──────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [sampleKey, setSampleKey] = useState<string | null>(null);   // 再生中キー
  const [loadingKey, setLoadingKey] = useState<string | null>(null); // 読込中キー

  const stopSample = useCallback(() => {
    if (audioRef.current) { try { audioRef.current.pause(); } catch { /* ignore */ } audioRef.current = null; }
    if (urlRef.current) { try { URL.revokeObjectURL(urlRef.current); } catch { /* ignore */ } urlRef.current = null; }
    setSampleKey(null);
    setLoadingKey(null);
  }, []);

  useEffect(() => () => stopSample(), [stopSample]);

  const playSample = useCallback(async (text: string, voice: string | undefined, key: string) => {
    if (!canSample || !text.trim()) return;
    stopSample();
    setLoadingKey(key);
    try {
      const blob = await geminiGenerateSpeech(text, voice ? { voice } : undefined);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      urlRef.current = url;
      audio.onplay = () => { setLoadingKey(null); setSampleKey(key); };
      const cleanup = () => {
        if (urlRef.current === url) { URL.revokeObjectURL(url); urlRef.current = null; }
        if (audioRef.current === audio) audioRef.current = null;
        setSampleKey((cur) => (cur === key ? null : cur));
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      await audio.play();
    } catch (err) {
      console.error('サンプル再生失敗:', err);
      setLoadingKey(null);
      setSampleKey(null);
    }
  }, [canSample, stopSample]);

  // ── フレーズ更新ハンドラ ───────────────────────────────
  const updateCheer = (list: string[]) => { setCheer(list); setCheerPhrases(list); };
  const updateTaunt = (list: string[]) => { setTaunt(list); setTauntPhrases(list); };
  const doResetCheer = () => { resetCheerPhrases(); setCheer(getCheerPhrases()); };
  const doResetTaunt = () => { resetTauntPhrases(); setTaunt(getTauntPhrases()); };

  // ── カスタムボイス ────────────────────────────────────
  const addVoice = () => {
    const id = nvId.trim();
    if (!id) return;
    const next = [...customVoices.filter((v) => v.id !== id), {
      id,
      label: nvLabel.trim() || id,
      desc: nvDesc.trim() || 'カスタムボイス',
    }];
    setCustomVoices(next);
    setNvId(''); setNvLabel(''); setNvDesc('');
    refresh();
  };
  const removeVoice = (id: string) => {
    setCustomVoices(customVoices.filter((v) => v.id !== id));
    refresh();
  };

  const changeTauntVoice = (id: string) => { setTauntV(id); setTauntVoice(id); };
  const changeCheerVoice = (id: string) => {
    const v = id === '__mic__' ? null : id;
    setCheerV(v); setCheerVoice(v);
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '9px 10px', borderRadius: 8,
    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', fontSize: 13, outline: 'none', marginTop: 4,
  };
  const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 };

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: 16, maxWidth: 640, margin: '0 auto', width: '100%',
    }}>
      <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>コール設定</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16 }}>
        コールボタン・10分コールの内容と、読み上げるボイスを追加・変更できます。設定は自動保存されます。
      </div>

      {!canSample && (
        <div style={{
          color: '#facc15', fontSize: 11, lineHeight: 1.5, padding: '10px 12px', marginBottom: 16,
          background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.2)', borderRadius: 10,
        }}>
          {!hasKey
            ? 'Gemini API キー未設定のため試聴はできません（設定内容は保存されます）。'
            : 'Web Speech 使用中のため試聴とボイス選択は Gemini 切替後に反映されます。'}
        </div>
      )}

      {/* 応援コール（コールボタン） */}
      <PhraseEditor
        title="応援コール（コールボタン 📣）"
        desc="ヘッダーのコールボタンと、10分コールの後にランダムで読み上げます。"
        phrases={cheer}
        onChange={updateCheer}
        onReset={doResetCheer}
        onSample={(text, i) => {
          const key = `cheer:${i}`;
          if (sampleKey === key || loadingKey === key) stopSample();
          else void playSample(text, cheerVoice ?? undefined, key);
        }}
        playingIdx={sampleKey?.startsWith('cheer:') ? Number(sampleKey.split(':')[1]) : null}
        loadingIdx={loadingKey?.startsWith('cheer:') ? Number(loadingKey.split(':')[1]) : null}
        canSample={canSample}
      />

      {/* 10分コール */}
      <PhraseEditor
        title="10分コール（経過時間コール）"
        desc="「◯分経過しました」に続けてランダムで読み上げるフレーズです。"
        phrases={taunt}
        onChange={updateTaunt}
        onReset={doResetTaunt}
        onSample={(text, i) => {
          const key = `taunt:${i}`;
          if (sampleKey === key || loadingKey === key) stopSample();
          else void playSample(text, tauntVoice, key);
        }}
        playingIdx={sampleKey?.startsWith('taunt:') ? Number(sampleKey.split(':')[1]) : null}
        loadingIdx={loadingKey?.startsWith('taunt:') ? Number(loadingKey.split(':')[1]) : null}
        canSample={canSample}
      />

      {/* ボイス設定 */}
      <div style={card}>
        <div style={sectionTitle}>ボイス設定</div>
        <div style={sectionDesc}>各コールで読み上げるボイスを選べます。</div>

        <div style={{ marginBottom: 14 }}>
          <span style={labelStyle}>10分コールのボイス</span>
          <select style={selectStyle} value={tauntVoice} onChange={(e) => changeTauntVoice(e.target.value)}>
            {allVoices.map((v) => (
              <option key={v.id} value={v.id}>{v.label}（{v.desc}）</option>
            ))}
          </select>
        </div>

        <div>
          <span style={labelStyle}>応援コールのボイス</span>
          <select style={selectStyle} value={cheerVoice ?? '__mic__'} onChange={(e) => changeCheerVoice(e.target.value)}>
            <option value="__mic__">マイクで選択中の声を使う</option>
            {allVoices.map((v) => (
              <option key={v.id} value={v.id}>{v.label}（{v.desc}）</option>
            ))}
          </select>
        </div>
      </div>

      {/* ボイスの種類を追加 */}
      <div style={card}>
        <div style={sectionTitle}>ボイスの種類を追加</div>
        <div style={sectionDesc}>
          Gemini のプリセットボイス名（例: Puck, Charon, Sulafat など）を指定してボイスを追加できます。
          追加したボイスは上のボイス選択と、マイク長押しの声メニューに表示されます。
        </div>

        {/* 既存のカスタムボイス */}
        {customVoices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {customVoices.map((v) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{v.label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v.id}・{v.desc}</div>
                </div>
                {canSample && (
                  <button
                    onClick={() => {
                      const key = `voice:${v.id}`;
                      if (sampleKey === key || loadingKey === key) stopSample();
                      else void playSample('こんにちは、サンプル音声です。', v.id, key);
                    }}
                    title="試聴"
                    style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: sampleKey === `voice:${v.id}` ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    {loadingKey === `voice:${v.id}` ? '…' : sampleKey === `voice:${v.id}` ? '■' : '▶'}
                  </button>
                )}
                <button
                  onClick={() => removeVoice(v.id)}
                  title="削除"
                  style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5', cursor: 'pointer', fontSize: 16, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input style={input} value={nvId} onChange={(e) => setNvId(e.target.value)} placeholder="ボイスID（Geminiのボイス名 例: Sulafat）" />
          <input style={input} value={nvLabel} onChange={(e) => setNvLabel(e.target.value)} placeholder="表示名（例: スラファト）" />
          <input style={input} value={nvDesc} onChange={(e) => setNvDesc(e.target.value)} placeholder="説明（例: 温かみのある女性）" />
          <button onClick={addVoice} style={{ ...smallBtn('#34d399'), alignSelf: 'flex-start' }}>ボイスを追加</button>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          組込みボイス: {GEMINI_VOICES.map((v) => v.id).join(', ')}
        </div>
      </div>
    </div>
  );
}

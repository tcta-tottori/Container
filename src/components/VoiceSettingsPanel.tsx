'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_VOICE_SETTINGS, VoiceSettings, MIN_RATE, MAX_RATE, MIN_PITCH, MAX_PITCH,
  getVoiceSettings, saveVoiceSettings, subscribeVoiceSettings, buildUtterance,
} from '@/lib/voiceSettings';

/** 試聴で読み上げる文 */
const SAMPLE_TEXT = 'ポリカバー、3パレットと2ケース。';

/** 見出し */
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700 }}>{children}</div>
      {hint && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** 数値スライダー（速さ・高さ・音量）。値の横の −／＋ で細かく動かせる */
function Slider({
  label, value, min, max, step, format, onChange, fineStep,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
  /** −／＋ ボタンで動かす幅 */
  fineStep: number;
}) {
  const nudge = (d: number) => {
    const v = Math.round((value + d) * 100) / 100;
    onChange(Math.min(max, Math.max(min, v)));
  };
  const fineBtn = (d: number, text: string) => (
    <button
      onClick={() => nudge(d)}
      aria-label={`${label}を${d > 0 ? '上げる' : '下げる'}`}
      style={{
        width: 30, height: 26, borderRadius: 8, flexShrink: 0,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
        color: '#e2e8f0', fontSize: 15, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
      }}
    >
      {text}
    </button>
  );
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span style={{ flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700 }}>{label}</span>
        {fineBtn(-fineStep, '−')}
        <span style={{
          minWidth: 52, textAlign: 'center',
          color: '#c4b5fd', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
        }}>
          {format(value)}
        </span>
        {fineBtn(fineStep, '＋')}
      </div>
      <input
        className="voice-range"
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** 音声コールの設定セクション。設定ページの「音声・コール」タブに表示する */
export default function VoiceSettingsPanel() {
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());
  /** 端末が持っている日本語の声（アプリ版では Google の高品質な声が並ぶ） */
  const [voices, setVoices] = useState<{ uri: string; name: string }[]>([]);
  const [testing, setTesting] = useState(false);

  // 外からの変更に表示を合わせる
  useEffect(() => subscribeVoiceSettings(setSettings), []);

  // 端末の声は少し遅れて出てくることがあるので、変化を待ち受ける
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const read = () => {
      const list = synth.getVoices()
        .filter((v) => v.lang && v.lang.toLowerCase().startsWith('ja'))
        .map((v) => ({ uri: v.voiceURI, name: v.name }));
      setVoices(list);
    };
    read();
    synth.addEventListener?.('voiceschanged', read);
    const timer = setInterval(read, 1000);
    const stop = setTimeout(() => clearInterval(timer), 8000);
    return () => {
      synth.removeEventListener?.('voiceschanged', read);
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, []);

  // パネルを閉じたら試聴を止める
  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const update = useCallback((next: VoiceSettings) => {
    setSettings(next);
    saveVoiceSettings(next);
  }, []);

  const playTest = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = buildUtterance(SAMPLE_TEXT, settings);
    setTesting(true);
    const end = () => setTesting(false);
    u.onend = end;
    u.onerror = end;
    window.speechSynthesis.speak(u);
  }, [settings]);

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

      <Label hint="端末に入っている日本語の声。アプリ版では「Google 音声サービス」の高品質な声もここに並びます">
        声
      </Label>
      {voices.length === 0 ? (
        <div style={{
          color: '#94a3b8', fontSize: 11, lineHeight: 1.6, marginBottom: 16,
          padding: '9px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          使える声を探しています。出てこないときは端末の既定の声で読み上げます。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {[{ uri: '', name: 'おまかせ（いちばん良い声）' }, ...voices].map((v) => {
            const active = settings.webVoice === v.uri;
            return (
              <button
                key={v.uri || 'auto'}
                onClick={() => update({ ...settings, webVoice: v.uri })}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10,
                  background: active ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      )}

      <Slider
        label="話す速さ" value={settings.rate} min={MIN_RATE} max={MAX_RATE} step={0.01} fineStep={0.01}
        format={(v) => `${v.toFixed(2)}倍`}
        onChange={(v) => update({ ...settings, rate: v })}
      />
      <Slider
        label="声の高さ" value={settings.pitch} min={MIN_PITCH} max={MAX_PITCH} step={0.01} fineStep={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => update({ ...settings, pitch: v })}
      />
      <Slider
        label="音量" value={settings.volume} min={0} max={1} step={0.01} fineStep={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => update({ ...settings, volume: v })}
      />

      <button
        onClick={playTest}
        disabled={testing}
        style={{
          width: '100%', padding: '13px', borderRadius: 12, marginTop: 4,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(74,110,247,0.25))',
          border: '1px solid rgba(167,139,250,0.5)',
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: testing ? 'default' : 'pointer', opacity: testing ? 0.6 : 1,
        }}
      >
        {testing ? '読み上げ中…' : 'この声で試聴'}
      </button>

      <button
        onClick={() => update({ ...DEFAULT_VOICE_SETTINGS })}
        style={{
          width: '100%', marginTop: 10, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#94a3b8', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        音声設定を初期値に戻す
      </button>

      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.6, marginTop: 12 }}>
        ※ 品名・残数・進捗・合図など、すべてのコールを端末の音声で読み上げます（通信なしで鳴ります）。<br />
        ※ 音量は端末の音声の仕様で 100% が上限です。もっと大きくしたいときは端末側のメディア音量を上げてください。<br />
        ※ 「Google 音声サービス」の高品質な声を入れておくと、標準の声よりはっきり聞き取れます。
      </p>
    </div>
  );
}

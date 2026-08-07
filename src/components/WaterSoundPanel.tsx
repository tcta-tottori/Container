'use client';

import { useWaterSound } from '@/hooks/useWaterSound';

/** 再生中に表示する波形インジケーター */
function PlayingBars() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: 3, borderRadius: 2, background: '#67e8f9', height: 4,
            animation: `water-bar 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 作業用BGM「水の流れる音」の設定セクション。
 * 設定ページ（SettingsPage）のタブとして表示する。
 */
export default function WaterSoundPanel() {
  const {
    playing, loading, error, volume, fadeSeconds, autoStart, isSupported,
    toggle, setVolume, setFadeSeconds, setAutoStart,
  } = useWaterSound();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes water-bar {
          0%, 100% { height: 4px; opacity: 0.55; }
          50% { height: 16px; opacity: 1; }
        }
        .water-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,0.15); outline: none;
        }
        .water-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 24px; height: 24px; border-radius: 50%;
          background: linear-gradient(135deg, #67e8f9, #38bdf8);
          border: 1px solid rgba(255,255,255,0.5); cursor: pointer;
        }
        .water-range::-moz-range-thumb {
          width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.5);
          background: linear-gradient(135deg, #67e8f9, #38bdf8); cursor: pointer;
        }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: 14,
      }}>
        <span style={{ flex: 1 }}>
          作業中に流す水の流れる音です。フェードイン・フェードアウトで自然に出入りします。
        </span>
        {playing && <PlayingBars />}
      </div>

      {!isSupported && (
        <div style={{
          color: '#facc15', fontSize: 13, lineHeight: 1.5, marginBottom: 12,
          padding: '9px 12px', borderRadius: 10,
          background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)',
        }}>
          この端末のブラウザは音声再生（Web Audio）に対応していないため再生できません。
        </div>
      )}
      {error && (
        <div style={{
          color: '#f87171', fontSize: 13, lineHeight: 1.5, marginBottom: 12,
          padding: '9px 12px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
        }}>
          {error}
        </div>
      )}

      {/* 再生／停止 */}
      <button
        onClick={toggle}
        disabled={!isSupported}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '18px 12px', borderRadius: 16, marginBottom: 18,
          cursor: isSupported ? 'pointer' : 'not-allowed',
          background: playing
            ? 'linear-gradient(135deg, rgba(34,211,238,0.22), rgba(56,189,248,0.12))'
            : 'rgba(255,255,255,0.05)',
          border: `1px solid ${playing ? 'rgba(103,232,249,0.5)' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: playing ? '0 0 20px rgba(103,232,249,0.18)' : 'none',
          color: '#fff', fontSize: 16, fontWeight: 700,
          transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          opacity: isSupported ? 1 : 0.5,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>{playing ? '⏸' : '▶'}</span>
        {loading ? '読み込み中...' : playing ? '停止（フェードアウト）' : '再生（フェードイン）'}
      </button>

      {/* 音量 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600 }}>音量</span>
          <span style={{ color: '#67e8f9', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
        <input
          className="water-range"
          type="range" min={0} max={100} step={1}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
        />
      </div>

      {/* フェード時間 */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600 }}>フェード時間</span>
          <span style={{ color: '#67e8f9', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {fadeSeconds.toFixed(1)}秒
          </span>
        </div>
        <input
          className="water-range"
          type="range" min={5} max={120} step={5}
          value={Math.round(fadeSeconds * 10)}
          onChange={(e) => setFadeSeconds(Number(e.target.value) / 10)}
        />
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 5 }}>
          再生開始と停止にかける時間。長いほど自然に出入りします。
        </div>
      </div>

      {/* 起動時の自動再生 */}
      <div
        onClick={() => setAutoStart(!autoStart)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '12px 14px', marginTop: 18, borderRadius: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>次回起動時も自動で流す</div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>
            アプリを開いて最初の操作をしたタイミングで再生します
          </div>
        </div>
        <div style={{
          width: 48, height: 28, borderRadius: 999, flexShrink: 0,
          background: autoStart ? 'linear-gradient(135deg, #22d3ee, #3b82f6)' : 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.15)', position: 'relative',
          transition: 'background 0.15s ease',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: autoStart ? 22 : 2,
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s ease',
          }} />
        </div>
      </div>

      <div style={{ color: '#64748b', fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
        ヘッダーの水滴ボタンでも再生・停止できます。音声コール中は自動で音量を下げます。
        iPhoneはマナーモードだと鳴りません。
      </div>
    </div>
  );
}

'use client';

import { AMBIENT_TRACKS } from '@/lib/ambientSound';
import { useAmbientSound } from '@/hooks/useAmbientSound';

interface AmbientSoundPanelProps {
  onClose: () => void;
}

/** 再生中トラックに表示する波形インジケーター */
function PlayingBars({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 2.5, borderRadius: 2, background: color, height: 4,
            animation: `ambient-bar 1.1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/** 作業用BGM（水音・涼感サウンド）の再生パネル */
export default function AmbientSoundPanel({ onClose }: AmbientSoundPanelProps) {
  const {
    activeIds, isPlaying, volume, fadeSeconds, autoStart, isSupported,
    toggle, stopAll, setVolume, setFadeSeconds, setAutoStart,
  } = useAmbientSound();

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
      <style>{`
        @keyframes ambient-bar {
          0%, 100% { height: 3px; opacity: 0.55; }
          50% { height: 12px; opacity: 1; }
        }
        .ambient-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 4px; border-radius: 999px;
          background: rgba(255,255,255,0.15); outline: none;
        }
        .ambient-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: linear-gradient(135deg, #67e8f9, #38bdf8);
          border: 1px solid rgba(255,255,255,0.5); cursor: pointer;
        }
        .ambient-range::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.5);
          background: linear-gradient(135deg, #67e8f9, #38bdf8); cursor: pointer;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #071626 0%, #0c1228 50%, #0a1a22 100%)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          borderRadius: 20, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          width: '100%', maxWidth: 440,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ヘッダー */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6, paddingBottom: 10,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            🌊 環境音BGM
            {isPlaying && <PlayingBars color="#67e8f9" />}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
          作業中に流す水音・涼しげな音です。タップで再生／停止（フェードイン・アウトします）。複数を重ねられます。
        </div>

        {!isSupported && (
          <div style={{
            color: '#facc15', fontSize: 12, lineHeight: 1.5, marginBottom: 12,
            padding: '8px 10px', borderRadius: 8,
            background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)',
          }}>
            この端末のブラウザは音声合成（Web Audio）に対応していないため再生できません。
          </div>
        )}

        {/* 音の一覧 */}
        <div style={{
          flex: 1, overflowY: 'auto', minHeight: 0,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8,
        }}>
          {AMBIENT_TRACKS.map((t) => {
            const on = activeIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                disabled={!isSupported}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  padding: '10px 12px', borderRadius: 12, cursor: isSupported ? 'pointer' : 'not-allowed',
                  background: on ? `linear-gradient(135deg, ${t.color}26, rgba(255,255,255,0.03))` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${on ? `${t.color}80` : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: on ? `0 0 16px ${t.color}33` : 'none',
                  transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  opacity: isSupported ? 1 : 0.5,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{t.emoji}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block', color: on ? '#fff' : 'rgba(255,255,255,0.85)',
                    fontSize: 13, fontWeight: 600,
                  }}>
                    {t.name}
                  </span>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>
                    {t.desc}
                  </span>
                </span>
                {on && <PlayingBars color={t.color} />}
              </button>
            );
          })}
        </div>

        {/* 音量 */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>音量</span>
            <span style={{ color: '#67e8f9', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            className="ambient-range"
            type="range" min={0} max={100} step={1}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
          />
        </div>

        {/* フェード時間 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>フェード時間</span>
            <span style={{ color: '#67e8f9', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {fadeSeconds.toFixed(1)}秒
            </span>
          </div>
          <input
            className="ambient-range"
            type="range" min={5} max={120} step={5}
            value={Math.round(fadeSeconds * 10)}
            onChange={(e) => setFadeSeconds(Number(e.target.value) / 10)}
          />
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
            再生開始と停止にかける時間。長いほど自然に出入りします。
          </div>
        </div>

        {/* 起動時の自動再生 */}
        <div
          onClick={() => setAutoStart(!autoStart)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 12px', marginTop: 14, borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>次回起動時も同じBGMを流す</div>
            <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
              アプリを開いて最初の操作をしたタイミングで自動再生します
            </div>
          </div>
          <div style={{
            width: 44, height: 26, borderRadius: 999, flexShrink: 0,
            background: autoStart ? 'linear-gradient(135deg, #22d3ee, #3b82f6)' : 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.15)', position: 'relative',
            transition: 'background 0.15s ease',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: autoStart ? 20 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.15s ease',
            }} />
          </div>
        </div>

        {/* 全停止 */}
        <button
          onClick={stopAll}
          disabled={!isPlaying}
          style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 10,
            background: isPlaying ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isPlaying ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: isPlaying ? '#f87171' : '#64748b',
            fontSize: 12, fontWeight: 600, cursor: isPlaying ? 'pointer' : 'default',
          }}
        >
          フェードアウトして全て停止
        </button>

        <div style={{ color: '#64748b', fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
          音声コール中は自動で音量を下げます。iPhoneはマナーモードだと鳴りません。
        </div>
      </div>
    </div>
  );
}

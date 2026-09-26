'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fixedCallCount, prepareFixedCalls, PrepareResult } from '@/lib/ttsPrepare';
import { clearSpeechCache, formatCacheBytes, speechCacheStats, SpeechCacheStats } from '@/lib/ttsCache';

interface CallCachePanelProps {
  /** Gemini の API キーが入っているか。無いと新しく作れない */
  hasKey: boolean;
}

/**
 * コールの音声を先に作っておくところ（設定 → 音声・コール）。
 *
 * 「お願いします！」「長谷川さん！」応援コール は毎回おなじ文なので、
 * 一度だけ作って端末に取っておけば、次からは待たずに鳴る。
 * 圏外でも鳴り、API も消費しない。
 */
export default function CallCachePanel({ hasKey }: CallCachePanelProps) {
  const [stats, setStats] = useState<SpeechCacheStats>({ count: 0, bytes: 0 });
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<PrepareResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    void speechCacheStats().then(setStats);
    setTotal(fixedCallCount());
  }, []);

  useEffect(() => {
    refresh();
    return () => { abortRef.current?.abort(); };
  }, [refresh]);

  const running = progress !== null;

  const start = async () => {
    if (running) return;
    setResult(null);
    const abort = new AbortController();
    abortRef.current = abort;
    setProgress({ done: 0, total: fixedCallCount() });
    try {
      const r = await prepareFixedCalls((p) => setProgress({ done: p.done, total: p.total }), abort.signal);
      setResult(r);
    } finally {
      abortRef.current = null;
      setProgress(null);
      refresh();
    }
  };

  const stop = () => abortRef.current?.abort();

  const clear = async () => {
    await clearSpeechCache();
    setResult(null);
    refresh();
  };

  return (
    <div style={{
      marginTop: 18, padding: 12, borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        コールを先に作っておく
      </div>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.6, margin: '0 0 10px' }}>
        中身が決まっているコール（{total} 件）の音声を、いま作って端末に取っておきます。
        次からは<strong style={{ color: '#7dd3fc' }}>待たずに鳴り</strong>、
        <strong style={{ color: '#7dd3fc' }}>圏外でも鳴り</strong>、API も使いません。
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={running ? stop : () => void start()}
          disabled={!hasKey && !running}
          style={{
            padding: '9px 14px', borderRadius: 10,
            background: running ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.18)',
            border: `1px solid ${running ? 'rgba(248,113,113,0.5)' : 'rgba(96,165,250,0.5)'}`,
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: !hasKey && !running ? 'default' : 'pointer',
            opacity: !hasKey && !running ? 0.5 : 1,
          }}
        >
          {running ? `やめる（${progress.done} / ${progress.total}）` : 'まとめて作る'}
        </button>

        <button
          onClick={() => void clear()}
          disabled={running || stats.count === 0}
          style={{
            padding: '9px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8', fontSize: 13, fontWeight: 500,
            cursor: running || stats.count === 0 ? 'default' : 'pointer',
            opacity: running || stats.count === 0 ? 0.5 : 1,
          }}
        >
          消す
        </button>

        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          取ってある音声: {stats.count} 件・{formatCacheBytes(stats.bytes)}
        </span>
      </div>

      {!hasKey && (
        <p style={{ color: '#fbbf24', fontSize: 11, lineHeight: 1.6, margin: '8px 0 0' }}>
          先に Gemini の API キーを入れてください。
        </p>
      )}

      {result && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.6, margin: '8px 0 0' }}>
          新しく作った {result.made} 件 / もう有った {result.kept} 件
          {result.failed > 0 && <span style={{ color: '#fbbf24' }}> / 作れなかった {result.failed} 件</span>}
        </p>
      )}
    </div>
  );
}

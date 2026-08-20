'use client';

import { useEffect, useRef } from 'react';
import { MIST_VIDEO, MIST_RATE } from '@/lib/mistVideo';

interface MistVideoProps {
  /** 動画のどこから流すか（秒） */
  from: number;
}

/**
 * 切り替えの煙。
 * 黒地に白い煙の映像を screen で重ねるので、黒い所は透けて煙だけが乗る。
 * 横向きの映像を90度回して縦画面いっぱいに使う。
 */
export default function MistVideo({ from }: MistVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = MIST_RATE;
    /*
     * 読めていない間に指定しても効かないので、読めてから位置を合わせる。
     * すでにその辺りを流しているときは動かさない。段階が変わるたびに
     * seek すると、そこで煙が一瞬止まって見えるため。
     */
    const seek = () => {
      if (Math.abs(v.currentTime - from) > 0.35) {
        try { v.currentTime = from; } catch { /* まだ動かせないときは次の機会に */ }
      }
      void v.play().catch(() => { /* 流せなくても切り替えは進む */ });
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener('loadedmetadata', seek, { once: true });
    return () => v.removeEventListener('loadedmetadata', seek);
  }, [from]);

  return (
    <video
      ref={ref}
      className="mist-video"
      src={MIST_VIDEO}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      controls={false}
      tabIndex={-1}
      aria-hidden
    />
  );
}

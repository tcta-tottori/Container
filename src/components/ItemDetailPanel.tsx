'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ContainerItem } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { extractColor, areSimilarItems, getSimilarityReason } from '@/lib/typeDetector';
import { buildJapanesePartName } from '@/lib/partTranslations';
import { getNabeModelColor, nabeColorToDarkBg } from '@/lib/nabeColors';
import { displayQuantities } from '@/lib/itemQuantity';
import { usePalletTap } from '@/hooks/usePalletTap';
import { useCountUp } from '@/hooks/useCountUp';
import PalletDiagram from './PalletDiagram';
import SizeDiagram, { parseMeas } from './SizeDiagram';

/* ===== 端数パレット全画面表示（残りが端数だけになった時に一時表示） =====
 * measure: 実寸を測る（非表示）→ start: 元のパレット位置に縮小配置（アニメなし）
 * → in: 全画面へゆっくり移動 → show: 操作受付 → out: 元の位置へ戻る
 * 移動中（in / out）も回り続けるので、回転しながら手前に出てきて回転しながら戻る。
 * 横スワイプで回転（画面幅いっぱいで180度）。触っていない間は勢いよく回り始め、
 * 作業画面の端数パレットと同じ速さ（15秒で1回転）まで徐々に落ちる。
 * 表示は7秒で、触ると最後の操作から数え直す。図の外をタップするとすぐ元に戻る。 */
type AutoFsPhase = 'idle' | 'measure' | 'start' | 'in' | 'show' | 'out';
/** 元の位置から全画面へ移動する時間（ゆっくり見せる） */
const AUTO_FS_IN_MS = 1400;
/** 元の位置へ戻る時間 */
const AUTO_FS_OUT_MS = 900;
/** 全画面を表示しておく時間。触ると最後の操作から数え直す */
const AUTO_FS_HOLD_MS = 7000;
/** スワイプをやめてから自動回転に戻るまでの間 */
const AUTO_FS_SPIN_DELAY_MS = 300;
/** 自動回転の初速（度/秒）。勢いよく回り始める */
const AUTO_FS_SPIN_DPS_START = 260;
/** 落ち着いたあとの速さ。作業画面の端数パレット（15秒で1回転）と同じにする */
const AUTO_FS_SPIN_DPS_END = 360 / 15;
/** 初速から終速へ近づく時定数（秒）。3倍の時間でほぼ終速になる */
const AUTO_FS_SPIN_EASE_SEC = 1.8;
/** 画面幅いっぱいのスワイプで回る角度 */
const AUTO_FS_SWIPE_DEG = 180;
/** 既定の見る角度 */
const FS_ROT_Y0 = -35;

interface ItemDetailPanelProps {
  item: ContainerItem;
  relatedItems: ContainerItem[];
  allItems: ContainerItem[];
  completedIds: Set<string>;
  onSelectItem?: (idx: number) => void;
  onCompleteItem?: (id: string) => void;
  onUncompleteItem?: (id: string) => void;
  onDecrementPallet?: () => void;
  onIncrementPallet?: () => void;
}

/** 2つの矩形を包む矩形を返す（どちらかが無ければある方をそのまま返す） */
function unionRect(a: DOMRect | null, b: DOMRect | null): DOMRect | null {
  if (!a) return b;
  if (!b) return a;
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  return new DOMRect(left, top, right - left, bottom - top);
}

/* ===== 類似品アイコン ===== */
function NameSimilarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#fff" stroke="#333" strokeWidth="1" />
      <text x="8" y="11.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#000">A</text>
    </svg>
  );
}

function ColorVariantIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id="cv-top"><polygon points="0,0 16,0 16,16" /></clipPath>
        <clipPath id="cv-bot"><polygon points="0,0 0,16 16,16" /></clipPath>
      </defs>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#fff" clipPath="url(#cv-top)" />
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#222" clipPath="url(#cv-bot)" />
      <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="#666" strokeWidth="1" />
      <line x1="1" y1="15" x2="15" y2="1" stroke="#666" strokeWidth="1" />
    </svg>
  );
}

/* ===== 類似品名の差異ハイライト ===== */
function HighlightDiff({ base, target }: { base: string; target: string }) {
  // 括弧部分を分離
  const baseParen = base.match(/\([^)]+\)/)?.[0] || '';
  const targetParen = target.match(/\([^)]+\)/)?.[0] || '';
  const baseCore = base.replace(/\([^)]+\)/, '').replace(/ポリカバー/g, '').trim();
  const targetCore = target.replace(/\([^)]+\)/, '').replace(/ポリカバー/g, '').trim();
  const targetDisplay = target.replace(/ポリカバー/g, '').trim();

  // コア部分の差異位置を特定
  const diffIndices = new Set<number>();
  const maxLen = Math.max(baseCore.length, targetCore.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= baseCore.length || i >= targetCore.length || baseCore[i] !== targetCore[i]) {
      diffIndices.add(i);
    }
  }

  // 括弧が違う場合は括弧全体を強調
  const parenDiff = baseParen !== targetParen;

  // targetDisplayをレンダリング（コア部分の差異は赤太字、括弧差異も赤太字）
  const parenInDisplay = targetDisplay.match(/\([^)]+\)/)?.[0] || '';
  const parenStart = targetDisplay.indexOf(parenInDisplay);

  const elements: React.ReactNode[] = [];
  let coreIdx = 0;
  for (let i = 0; i < targetDisplay.length; i++) {
    const inParen = parenInDisplay && i >= parenStart && i < parenStart + parenInDisplay.length;
    if (inParen) {
      if (parenDiff) {
        elements.push(<span key={i} style={{ color: '#ef4444', fontWeight: 900 }}>{targetDisplay[i]}</span>);
      } else {
        elements.push(<span key={i}>{targetDisplay[i]}</span>);
      }
    } else {
      if (diffIndices.has(coreIdx)) {
        elements.push(<span key={i} style={{ color: '#ef4444', fontWeight: 900 }}>{targetDisplay[i]}</span>);
      } else {
        elements.push(<span key={i}>{targetDisplay[i]}</span>);
      }
      coreIdx++;
    }
  }

  return <span>{elements}</span>;
}

/* ===== マーキーテキスト ===== */
function MarqueeText({ text, className, style }: {
  text: string; className?: string; style?: React.CSSProperties;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (outerRef.current && innerRef.current) {
        setOverflow(innerRef.current.scrollWidth > outerRef.current.clientWidth + 2);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text]);

  return (
    <div ref={outerRef} className={`marquee-outer ${className || ''}`} style={style}>
      <div className={overflow ? 'marquee-scroll' : ''}>
        <span ref={innerRef} className="marquee-text">{text}</span>
        {overflow && <span className="marquee-text marquee-dup" aria-hidden="true">{text}</span>}
      </div>
    </div>
  );
}

/* ===== 類似品マーキー ===== */
function SimilarItemsMarquee({ item, similarItems }: {
  item: ContainerItem; similarItems: ContainerItem[];
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const check = () => {
      if (outerRef.current && innerRef.current) {
        setOverflow(innerRef.current.scrollWidth > outerRef.current.clientWidth + 2);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [item.id, similarItems.length]);

  const content = similarItems.map((s, i) => {
    const reason = getSimilarityReason(item.itemName, s.itemName);
    return (
      <span key={s.id} style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 13, fontWeight: 500, color: '#fcd34d',
        textShadow: '0 0 6px rgba(251,191,36,0.3)',
      }}>
        {i > 0 && <span style={{ color: 'rgba(251,191,36,0.4)', margin: '0 4px' }}>|</span>}
        {reason === 'color' ? <ColorVariantIcon size={15} /> : <NameSimilarIcon size={15} />}
        <HighlightDiff base={item.itemName} target={s.itemName} />
      </span>
    );
  });

  return (
    <div className="similar-warn-blink" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      borderRadius: 20, padding: '4px 12px',
      border: '1.5px solid rgba(251,191,36,0.3)',
      flexShrink: 0, position: 'relative', zIndex: 2,
      overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      <span style={{
        fontSize: 13, fontWeight: 500, color: '#fbbf24', whiteSpace: 'nowrap', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        類似品:
      </span>
      <div ref={outerRef} style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
        <div className={overflow ? 'marquee-scroll' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <div ref={innerRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {content}
          </div>
          {overflow && (
            <div aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 40 }}>
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== 数値フォーマット ===== */
function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Math.ceil(v * 100) / 100);
}

/* ===== 品名省略 ===== */
function shortenName(name: string): string {
  return name.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '') || name;
}

/* ===== スワイプ行（左→右にスワイプで完了） ===== */
function SwipeRow({ children, onSwipe, style, className }: {
  children: React.ReactNode; onSwipe: () => void;
  style?: React.CSSProperties; className?: string;
}) {
  const startX = useRef(0);
  const dx = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const onTS = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX; dx.current = 0;
  }, []);
  const onTM = useCallback((e: React.TouchEvent) => {
    dx.current = e.touches[0].clientX - startX.current;
    if (rowRef.current && dx.current > 0) {
      rowRef.current.style.transform = `translateX(${Math.min(dx.current, 120)}px)`;
      rowRef.current.style.transition = 'none';
    }
  }, []);
  const onTE = useCallback(() => {
    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      if (dx.current > 80) {
        rowRef.current.style.transform = 'translateX(100%)';
        rowRef.current.style.opacity = '0';
        setTimeout(() => onSwipe(), 260);
      } else { rowRef.current.style.transform = 'translateX(0)'; }
    }
  }, [onSwipe]);

  return (
    <div style={{ overflow: 'visible', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%',
        background: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)',
        boxShadow: '0 0 20px rgba(34,197,94,0.5), 0 0 40px rgba(34,197,94,0.2), inset 0 0 10px rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', paddingLeft: 16,
        color: '#fff', fontSize: 12, fontWeight: 700, gap: 4,
        textShadow: '0 0 8px rgba(255,255,255,0.6)',
      }}>✓ 完了</div>
      <div ref={rowRef} className={className} style={{ ...style, position: 'relative', zIndex: 1 }}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      >{children}</div>
    </div>
  );
}

/* ===== スワイプ行（右→左にスワイプで元に戻す） ===== */
function UndoSwipeRow({ children, onSwipe, style, className, onClick }: {
  children: React.ReactNode; onSwipe: () => void; onClick?: () => void;
  style?: React.CSSProperties; className?: string;
}) {
  const startX = useRef(0);
  const dx = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  const onTS = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX; dx.current = 0;
  }, []);
  const onTM = useCallback((e: React.TouchEvent) => {
    dx.current = e.touches[0].clientX - startX.current;
    if (rowRef.current && dx.current < 0) {
      rowRef.current.style.transform = `translateX(${Math.max(dx.current, -120)}px)`;
      rowRef.current.style.transition = 'none';
    }
  }, []);
  const onTE = useCallback(() => {
    if (rowRef.current) {
      rowRef.current.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      if (dx.current < -80) {
        rowRef.current.style.transform = 'translateX(-100%)';
        rowRef.current.style.opacity = '0';
        setTimeout(() => onSwipe(), 260);
      } else { rowRef.current.style.transform = 'translateX(0)'; }
    }
  }, [onSwipe]);

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '100%',
        background: 'linear-gradient(270deg, #dc2626 0%, #ef4444 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16,
        color: '#fff', fontSize: 12, fontWeight: 700, gap: 4,
      }}>↩ 元に戻す</div>
      <div ref={rowRef} className={className} style={{ ...style, position: 'relative', zIndex: 1 }}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onClick={onClick}
      >{children}</div>
    </div>
  );
}

export default function ItemDetailPanel({
  item, relatedItems, allItems, completedIds, onSelectItem, onCompleteItem, onUncompleteItem,
  onDecrementPallet, onIncrementPallet,
}: ItemDetailPanelProps) {
  const colors = COLOR_MAP[item.type] || COLOR_MAP['その他'];
  // 鍋は機種別カラーを使用（上半分の背景・アクセント色を差し替え）
  const nabeColor = getNabeModelColor(item.itemName, item.type);
  const accentColor = nabeColor || colors.accent;
  const [palletFlash, setPalletFlash] = useState(false);
  const [fullscreenPallet, setFullscreenPallet] = useState<'full' | 'fraction' | null>(null);
  const [fsRotateY, setFsRotateY] = useState(-35);
  const fsTouchRef = useRef<{ startX: number; startRotY: number } | null>(null);
  // 端数パレットのみになった時の全画面表示
  const [autoFs, setAutoFs] = useState<AutoFsPhase>('idle');
  const autoFsPhaseRef = useRef<AutoFsPhase>('idle');
  const autoFsSeqRef = useRef(0);
  const autoFsHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 全画面の元になる端数パレットの位置（ここからズームする） */
  const fractionSrcRef = useRef<HTMLDivElement | null>(null);
  const autoFsSrcRectRef = useRef<DOMRect | null>(null);
  /** 元の位置へ戻すための移動量と縮小率 */
  const [autoFsFlip, setAutoFsFlip] = useState<{ dx: number; dy: number; s: number } | null>(null);
  /**
   * 全画面中の回転角。React の再描画を挟むと 20fps 程度になってカクつくため、
   * 角度は ref で持ち、毎フレーム DOM の transform を直接書き換える。
   */
  const autoFsRotRef = useRef(FS_ROT_Y0);
  const autoFsBodyElRef = useRef<HTMLElement | null>(null);
  const autoFsDragRef = useRef<{ x: number; y: number; rotY: number; moved: boolean } | null>(null);
  /** 最後に触った時刻。これを過ぎると自動回転を再開する */
  const autoFsLastActRef = useRef(0);
  /** 自動回転を始めた時刻。ここからの経過で回転速度を落としていく */
  const autoFsSpinT0Ref = useRef(0);

  /** 全画面の文字が飛び出す元（作業画面の CT 表示） */
  const ctStatRef = useRef<HTMLDivElement | null>(null);
  const pcsStatRef = useRef<HTMLDivElement | null>(null);
  const autoFsCapRef = useRef<HTMLDivElement | null>(null);
  const autoFsCapSrcRectRef = useRef<DOMRect | null>(null);
  /** 文字を元の CT 表示位置へ写すための移動量と拡大率 */
  const [autoFsCapFlip, setAutoFsCapFlip] = useState<{ dx: number; dy: number; s: number } | null>(null);
  const [animKey, setAnimKey] = useState(item.id);
  const [transitionPhase, setTransitionPhase] = useState<'visible' | 'fadeout' | 'blank' | 'fadein'>('visible');
  const prevItemIdRef = useRef(item.id);

  // 品目切替検知 → なだらかにフェードアウト→データ更新→フェードイン
  useEffect(() => {
    if (prevItemIdRef.current !== item.id) {
      prevItemIdRef.current = item.id;
      setTransitionPhase('fadeout');
      // フェードアウト完了(0.4s)を待ってからblank
      const t1 = setTimeout(() => setTransitionPhase('blank'), 400);
      const t2 = setTimeout(() => {
        setAnimKey(item.id);
        setTransitionPhase('fadein');
      }, 500);
      const t3 = setTimeout(() => setTransitionPhase('visible'), 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [item.id]);

  // 上半分コンテンツの表示状態
  const upperOpacity = (transitionPhase === 'fadeout' || transitionPhase === 'blank') ? 0 : 1;
  const upperTransition = transitionPhase === 'fadeout' ? 'opacity 0.4s ease' : transitionPhase === 'fadein' ? 'opacity 0.5s ease' : 'none';
  const showContent = transitionPhase !== 'blank';

  /** パレット数: 1回タップで減らす／2回タップで増やす（元の枚数までしか戻らない） */
  const flashPallet = useCallback(() => {
    setPalletFlash(true);
    setTimeout(() => setPalletFlash(false), 200);
  }, []);
  const handlePalletTap = usePalletTap(
    useCallback(() => { onDecrementPallet?.(); flashPallet(); }, [onDecrementPallet, flashPallet]),
    useCallback(() => { onIncrementPallet?.(); flashPallet(); }, [onIncrementPallet, flashPallet]),
  );
  const itemColor = extractColor(item.itemName);
  // 鍋は類似品なし、関連として同じサイズのものを表示
  const isCurrentNabe = item.type === '鍋';
  const currentNabeIs180 = isCurrentNabe && (item.itemName.includes('180') || /18[RWCS]/.test(item.itemName));
  const similarItems = isCurrentNabe ? [] : allItems.filter(
    (o) => o.id !== item.id && areSimilarItems(item.itemName, o.itemName)
  );
  const nabeRelatedItems = isCurrentNabe ? allItems.filter(o => {
    if (o.id === item.id || o.type !== '鍋') return false;
    const o180 = o.itemName.includes('180') || /18[RWCS]/.test(o.itemName);
    return currentNabeIs180 === o180; // 同じサイズのみ
  }).slice(0, 6) : [];
  const effectiveRelatedItems = isCurrentNabe ? nabeRelatedItems : relatedItems;
  const relatedText = effectiveRelatedItems.map((r) => r.itemName).join('  /  ');

  const isNabeContainer = allItems.some(it => it.type === '鍋');
  const activeItems = allItems.filter((it) => !completedIds.has(it.id));
  const doneItems = allItems.filter((it) => completedIds.has(it.id));
  // 鍋コンテナ: ①サイズ(100→180) ②機種名でソート
  const nabeSort = (a: ContainerItem, b: ContainerItem) => {
    if (!isNabeContainer) return 0;
    const a180 = a.itemName.includes('180') || /18[RWCS]/.test(a.itemName) ? 1 : 0;
    const b180 = b.itemName.includes('180') || /18[RWCS]/.test(b.itemName) ? 1 : 0;
    if (a180 !== b180) return a180 - b180;
    return a.itemName.localeCompare(b.itemName);
  };
  const sortedItems = isNabeContainer
    ? [...activeItems.sort(nabeSort), ...doneItems.sort(nabeSort)]
    : [...activeItems, ...doneItems];

  const japanesePartName = buildJapanesePartName(item);
  const displayItemName = japanesePartName
    || item.itemName.replace(/ポリカバー/g, '').replace(/^[\s\-]+|[\s\-]+$/g, '')
    || item.itemName;

  // コンテナ内全アイテムの最大寸法を計算（箱イメージのスケーリング基準）
  const maxContainerDim = (() => {
    let maxD = 0;
    for (const it of allItems) {
      if (it.measurements) {
        const d = parseMeas(it.measurements);
        if (d) maxD = Math.max(maxD, d[0], d[1], d[2]);
      }
    }
    return maxD || 50;
  })();

  // 現在のアイテムの寸法
  const currentDims = item.measurements ? parseMeas(item.measurements) : null;

  const typeCounts = new Map<string, number>();
  // 鍋コンテナ: サイズ別に分離（100→180の順で表示）
  if (isNabeContainer) {
    // 100を先に登録して順序を保証
    typeCounts.set('鍋100', 0);
    typeCounts.set('鍋180', 0);
  }
  for (const it of allItems) {
    if (it.type === '鍋' && isNabeContainer) {
      const is180 = it.itemName.includes('180') || /18[RWCS]/.test(it.itemName);
      const sizeKey = is180 ? '鍋180' : '鍋100';
      typeCounts.set(sizeKey, (typeCounts.get(sizeKey) || 0) + 1);
    } else {
      typeCounts.set(it.type, (typeCounts.get(it.type) || 0) + 1);
    }
  }
  // 0件のエントリを除去
  typeCounts.forEach((v, k) => { if (v === 0) typeCounts.delete(k); });

  // リスト行の背景色（メニューカラーと統一・ダーク系）
  const TYPE_ROW_BG: Record<string, string> = {
    'ポリカバー': '#162218', 'ジャーポット': '#1e1520', '箱': '#151e2c', '部品': '#1c1628', '鍋': '#1e1518', 'ヤーマン部品': '#1c1a14', 'その他': '#1a1a1e',
  };

  // 種類別の背景色（ダーク/ライト）
  const isLightMode = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const HERO_BG_DARK: Record<string, { base: string; c1: string; c2: string; c3: string }> = {
    'ポリカバー': { base: '#081a12', c1: '#0a3d22', c2: '#06291a', c3: '#0d4a2a' },
    'ジャーポット': { base: '#1a0818', c1: '#3d0a35', c2: '#29061e', c3: '#4a0d42' },
    '箱': { base: '#1a1008', c1: '#3d280a', c2: '#291c06', c3: '#4a300d' },
    '部品': { base: '#12081a', c1: '#280a3d', c2: '#1c0629', c3: '#300d4a' },
    '鍋': { base: '#1a0808', c1: '#3d0a0a', c2: '#290606', c3: '#4a0d0d' },
    'ヤーマン部品': { base: '#1a1608', c1: '#3d320a', c2: '#292406', c3: '#4a3c0d' },
    'その他': { base: '#101218', c1: '#1a2030', c2: '#141822', c3: '#1e2838' },
  };
  const HERO_BG_LIGHT: Record<string, { base: string; c1: string; c2: string; c3: string }> = {
    'ポリカバー': { base: '#0e8040', c1: '#009868', c2: '#38a828', c3: '#08904a' },    // 濃い緑→シアン
    'ジャーポット': { base: '#6830a8', c1: '#902880', c2: '#5038b0', c3: '#883098' },   // 濃い紫
    '箱': { base: '#a87810', c1: '#b89018', c2: '#986808', c3: '#c08818' },             // 濃いゴールド
    '部品': { base: '#4040a8', c1: '#6030b8', c2: '#2858c0', c3: '#5038a8' },           // 濃い青紫
    '鍋': { base: '#b83028', c1: '#c85020', c2: '#a82840', c3: '#c04828' },             // 濃い赤
    'ヤーマン部品': { base: '#907810', c1: '#a89018', c2: '#806808', c3: '#988018' },   // 濃いゴールド
    'その他': { base: '#386888', c1: '#2860a0', c2: '#487880', c3: '#205898' },         // 濃い青
  };
  const HERO_BG = isLightMode ? HERO_BG_LIGHT : HERO_BG_DARK;
  // 鍋はnabeColorから背景を動的生成
  const heroBg = (() => {
    if (item.type === '鍋' && nabeColor) {
      const hex = nabeColor.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (isLightMode) {
        return {
          base: `rgb(${Math.min(200, Math.round(r * 0.6 + 20))},${Math.min(200, Math.round(g * 0.6 + 20))},${Math.min(200, Math.round(b * 0.6 + 20))})`,
          c1: `rgb(${Math.min(200, Math.round(r * 0.7 + 10))},${Math.min(200, Math.round(g * 0.5 + 40))},${Math.min(200, Math.round(b * 0.7 + 10))})`,
          c2: `rgb(${Math.min(200, Math.round(r * 0.5 + 40))},${Math.min(200, Math.round(g * 0.65 + 20))},${Math.min(200, Math.round(b * 0.65 + 20))})`,
          c3: `rgb(${Math.min(200, Math.round(r * 0.75))},${Math.min(200, Math.round(g * 0.55 + 30))},${Math.min(200, Math.round(b * 0.6 + 20))})`,
        };
      }
      return {
        base: `rgb(${Math.round(r * 0.1 + 8)},${Math.round(g * 0.1 + 8)},${Math.round(b * 0.1 + 8)})`,
        c1: `rgb(${Math.round(r * 0.24 + 5)},${Math.round(g * 0.24 + 5)},${Math.round(b * 0.24 + 5)})`,
        c2: `rgb(${Math.round(r * 0.16 + 4)},${Math.round(g * 0.16 + 4)},${Math.round(b * 0.16 + 4)})`,
        c3: `rgb(${Math.round(r * 0.29 + 6)},${Math.round(g * 0.29 + 6)},${Math.round(b * 0.29 + 6)})`,
      };
    }
    return HERO_BG[item.type] || HERO_BG['その他'];
  })();

  const heroVars = {
    '--hero-c1': heroBg.c1,
    '--hero-c2': heroBg.c2,
    '--hero-c3': heroBg.c3,
    '--hero-bg': heroBg.base,
  } as React.CSSProperties;

  // カウントアップアニメーション（フェードアウト中は値をフリーズ）
  const isTransitioning = animKey !== item.id;
  const rawFraction = item.fraction % 1 !== 0 ? Math.ceil(item.fraction) : item.fraction;
  // PL / CT / pcs の求め方は せせらぎモードと共通（src/lib/itemQuantity.ts）
  const { pallets: displayPallets, cartons: inspectionDeducted } = displayQuantities(item);
  const plTarget = isTransitioning ? undefined : displayPallets;
  const ctTarget = isTransitioning ? undefined : inspectionDeducted;
  const pcsTarget = isTransitioning ? undefined : Math.ceil(item.totalQty);
  const animPL = useCountUp(plTarget ?? 0, animKey, isTransitioning);
  const animCT = useCountUp(ctTarget ?? 0, animKey, isTransitioning);
  const animPCS = useCountUp(pcsTarget ?? 0, animKey, isTransitioning);

  // ===== 残りが端数パレットになったら積み方を全画面表示（操作が5秒途切れたら戻る） =====
  const setAutoFsPhase = useCallback((phase: AutoFsPhase) => {
    autoFsPhaseRef.current = phase;
    setAutoFs(phase);
  }, []);

  const closeAutoFullscreen = useCallback(() => {
    if (autoFsPhaseRef.current === 'idle' || autoFsPhaseRef.current === 'out') return;
    if (autoFsHoldRef.current) { clearTimeout(autoFsHoldRef.current); autoFsHoldRef.current = null; }
    const seq = ++autoFsSeqRef.current;
    setAutoFsPhase('out');
    setTimeout(() => {
      if (autoFsSeqRef.current === seq) { setAutoFsPhase('idle'); setAutoFsFlip(null); setAutoFsCapFlip(null); }
    }, AUTO_FS_OUT_MS);
  }, [setAutoFsPhase]);

  /** 表示時間を数え直す（触るたびに呼ぶ） */
  const bumpAutoFsHold = useCallback(() => {
    if (autoFsHoldRef.current) clearTimeout(autoFsHoldRef.current);
    autoFsHoldRef.current = setTimeout(closeAutoFullscreen, AUTO_FS_HOLD_MS);
  }, [closeAutoFullscreen]);

  const openAutoFullscreen = useCallback(() => {
    // 画面に出ている端数パレットの位置を記録し、そこからゆっくり移動させる
    autoFsSrcRectRef.current = fractionSrcRef.current?.getBoundingClientRect() ?? null;
    autoFsCapSrcRectRef.current = unionRect(
      ctStatRef.current?.getBoundingClientRect() ?? null,
      pcsStatRef.current?.getBoundingClientRect() ?? null,
    );
    autoFsSeqRef.current++;
    autoFsRotRef.current = FS_ROT_Y0;
    autoFsBodyElRef.current = null;
    setAutoFsFlip(null);
    setAutoFsCapFlip(null);
    // 移動を始めた瞬間から回すので、待ち時間は入れない
    autoFsLastActRef.current = 0;
    autoFsSpinT0Ref.current = 0;
    setAutoFsPhase('measure');
  }, [setAutoFsPhase]);

  /** 端数パレットのタップ: 自動表示と同じ全画面を開く（表示中なら閉じる） */
  const handleFractionTap = useCallback(() => {
    if (autoFsPhaseRef.current === 'idle') openAutoFullscreen();
    else closeAutoFullscreen();
  }, [openAutoFullscreen, closeAutoFullscreen]);

  // フェーズ進行: 実寸を測る → 元の位置に置く → 全画面へ移動
  useEffect(() => {
    if (autoFs === 'measure') {
      const box = autoFsBoxRef.current;
      const src = autoFsSrcRectRef.current;
      const r = box?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0 && src && src.width > 0 && src.height > 0) {
        setAutoFsFlip({
          dx: (src.left + src.width / 2) - (r.left + r.width / 2),
          dy: (src.top + src.height / 2) - (r.top + r.height / 2),
          s: Math.max(0.06, Math.min(src.width / r.width, src.height / r.height)),
        });
      } else {
        // 元位置が取れないときは中央から拡大する
        setAutoFsFlip({ dx: 0, dy: 0, s: 0.28 });
      }
      // 文字は作業画面の CT 表示の位置・大きさから図と一緒に下りてくる
      const cap = autoFsCapRef.current?.getBoundingClientRect();
      const capSrc = autoFsCapSrcRectRef.current;
      if (cap && cap.height > 0 && capSrc && capSrc.height > 0) {
        setAutoFsCapFlip({
          dx: (capSrc.left + capSrc.width / 2) - (cap.left + cap.width / 2),
          dy: (capSrc.top + capSrc.height / 2) - (cap.top + cap.height / 2),
          // 数字の大きさをそろえたいので高さ基準で拡大率を決める
          s: Math.max(0.5, Math.min(2.5, capSrc.height / cap.height)),
        });
      } else {
        setAutoFsCapFlip({ dx: 0, dy: 0, s: 1 });
      }
      setAutoFsPhase('start');
      return;
    }
    if (autoFs === 'start') {
      // 縮小状態を1フレーム描いてから移動を開始する（アニメーションの取りこぼし防止）
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setAutoFsPhase('in')); });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
    if (autoFs === 'in') {
      bumpAutoFsHold();
      const t = setTimeout(() => setAutoFsPhase('show'), AUTO_FS_IN_MS);
      return () => clearTimeout(t);
    }
  }, [autoFs, setAutoFsPhase, bumpAutoFsHold]);

  /** 回転角をパレットへ即座に反映する（再描画を挟まない） */
  const applyAutoFsRot = useCallback((deg: number) => {
    autoFsRotRef.current = deg;
    let el = autoFsBodyElRef.current;
    if (!el || !el.isConnected) {
      el = (autoFsBoxRef.current?.querySelector('[data-pallet-body]') as HTMLElement | null) ?? null;
      autoFsBodyElRef.current = el;
      // 合成レイヤーに載せて、回転のたびに描き直さないようにする
      if (el) el.style.willChange = 'transform';
    }
    if (el) el.style.transform = `rotateX(-25deg) rotateY(${deg}deg)`;
  }, []);

  // 触っていない間は自動回転する。毎フレーム DOM を直接更新するので滑らかに回る。
  // 出入り（in / out）の移動中も回すので、回転しながら出てきて回転しながら戻る。
  useEffect(() => {
    if (autoFs !== 'in' && autoFs !== 'show' && autoFs !== 'out') return;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (autoFsDragRef.current || now - autoFsLastActRef.current < AUTO_FS_SPIN_DELAY_MS) {
        last = now;
        return;
      }
      if (!last) { last = now; return; }
      if (!autoFsSpinT0Ref.current) autoFsSpinT0Ref.current = now;
      const dt = now - last;
      last = now;
      // 初速から終速へ指数的に近づける（勢いよく回り始めて、作業画面と同じ速さに落ち着く）
      const elapsed = (now - autoFsSpinT0Ref.current) / 1000;
      const dps = AUTO_FS_SPIN_DPS_END
        + (AUTO_FS_SPIN_DPS_START - AUTO_FS_SPIN_DPS_END) * Math.exp(-elapsed / AUTO_FS_SPIN_EASE_SEC);
      applyAutoFsRot(autoFsRotRef.current + (dps * dt) / 1000);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [autoFs, applyAutoFsRot]);

  // 横スワイプで回転（画面幅いっぱいで180度）
  const handleAutoFsPointerDown = useCallback((e: React.PointerEvent) => {
    if (autoFsPhaseRef.current === 'out') return;
    autoFsDragRef.current = { x: e.clientX, y: e.clientY, rotY: autoFsRotRef.current, moved: false };
    autoFsLastActRef.current = performance.now();
    bumpAutoFsHold();
  }, [bumpAutoFsHold]);

  const handleAutoFsPointerMove = useCallback((e: React.PointerEvent) => {
    const d = autoFsDragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6 || Math.abs(e.clientY - d.y) > 6) d.moved = true;
    const degPerPx = AUTO_FS_SWIPE_DEG / Math.max(1, window.innerWidth);
    applyAutoFsRot(d.rotY + dx * degPerPx);
    autoFsLastActRef.current = performance.now();
    bumpAutoFsHold();
  }, [bumpAutoFsHold, applyAutoFsRot]);

  const handleAutoFsPointerUp = useCallback((e: React.PointerEvent) => {
    const d = autoFsDragRef.current;
    autoFsDragRef.current = null;
    autoFsLastActRef.current = performance.now();
    bumpAutoFsHold();
    if (!d || d.moved) return;
    // 図の外をタップしたら元に戻す（図の上のタップは何もしない）
    const body = autoFsBoxRef.current?.querySelector('[data-pallet-body]') as HTMLElement | null;
    const r = body?.getBoundingClientRect();
    const onFigure = !!r
      && e.clientX >= r.left - 16 && e.clientX <= r.right + 16
      && e.clientY >= r.top - 16 && e.clientY <= r.bottom + 16;
    if (!onFigure) closeAutoFullscreen();
  }, [closeAutoFullscreen, bumpAutoFsHold]);

  // アンマウント時にタイマーを掃除
  useEffect(() => () => {
    if (autoFsHoldRef.current) clearTimeout(autoFsHoldRef.current);
    autoFsSeqRef.current++;
  }, []);

  // 端数のみになった瞬間（パレット消化・品目切替）に1品目1度だけ全画面表示
  const autoZoomDoneRef = useRef<Set<string>>(new Set());
  const isFractionOnly = displayPallets === 0 && inspectionDeducted > 0;
  const prevFractionStateRef = useRef<{ id: string; fractionOnly: boolean } | null>(null);
  useEffect(() => {
    if (isTransitioning) return;
    const prev = prevFractionStateRef.current;
    prevFractionStateRef.current = { id: item.id, fractionOnly: isFractionOnly };
    // 作業シート初回表示はスキップ（「端数になった」瞬間のみ表示）
    if (prev === null) return;
    if (!isFractionOnly) return;
    // 端数のみに変化した or 端数のみの品目に切り替わった時だけ
    if (prev.fractionOnly && prev.id === item.id) return;
    if (autoZoomDoneRef.current.has(item.id)) return;
    autoZoomDoneRef.current.add(item.id);
    const t = setTimeout(openAutoFullscreen, 400);
    return () => clearTimeout(t);
  }, [item.id, isFractionOnly, isTransitioning, openAutoFullscreen]);

  // 品目が切り替わったら表示中の全画面は閉じる
  useEffect(() => {
    closeAutoFullscreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // パレット図は固定pxで描画されるため、全画面枠いっぱいになる倍率を実測して合わせる
  const autoFsBoxRef = useRef<HTMLDivElement | null>(null);
  const [autoFsScale, setAutoFsScale] = useState(1);
  useEffect(() => {
    if (autoFs === 'idle') return;
    const host = autoFsBoxRef.current;
    if (!host) return;
    const fit = () => {
      const body = host.querySelector('[data-pallet-body]') as HTMLElement | null;
      if (!body) return;
      const w = body.offsetWidth;
      const h = body.offsetHeight;
      if (!w || !h) return;
      // 回転(rotateX/rotateY)で見かけの幅・高さが増えるぶんの余裕を持たせる
      const scale = Math.min(host.clientWidth / (w * 1.45), host.clientHeight / (h * 1.2));
      setAutoFsScale(Math.max(1, Math.min(scale, 8)));
    };
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [autoFs, item.id, inspectionDeducted]);

  // 全画面のパレット図も、端数の全画面と同じように枠いっぱいの大きさに合わせる
  const fsBoxRef = useRef<HTMLDivElement | null>(null);
  const [fsScale, setFsScale] = useState(1);
  useEffect(() => {
    if (!fullscreenPallet) { setFsScale(1); return; }
    const host = fsBoxRef.current;
    if (!host) return;
    const fit = () => {
      const body = host.querySelector('[data-pallet-body]') as HTMLElement | null;
      if (!body) return;
      const w = body.offsetWidth;
      const h = body.offsetHeight;
      if (!w || !h) return;
      // 回転(rotateX/rotateY)で見かけの幅・高さが増えるぶんの余裕を持たせる
      const scale = Math.min(host.clientWidth / (w * 1.45), host.clientHeight / (h * 1.2));
      setFsScale(Math.max(1, Math.min(scale, 10)));
    };
    const raf = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(raf);
  }, [fullscreenPallet, item.id, item.palletCount, inspectionDeducted]);

  return (
    <div className="detail-root" style={{ background: '#1a1d2e' }}>
      {/* === 上半分（アニメーショングラデーション） === */}
      <div className="detail-upper hero-animated" style={{
        position: 'relative', overflow: 'hidden', ...heroVars,
      }}>
        {/* 深いグラデーション背景 + ノイズテクスチャ */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `
            radial-gradient(ellipse 120% 80% at 70% 30%, var(--hero-c1) 0%, transparent 60%),
            radial-gradient(ellipse 100% 100% at 20% 80%, var(--hero-c3) 0%, transparent 50%),
            radial-gradient(ellipse 80% 60% at 90% 70%, var(--hero-c2) 0%, transparent 55%),
            var(--hero-bg)
          `,
        }} />
        {/* 動く靄レイヤー */}
        <div className="hero-glow-layer" style={{
          background: `
            radial-gradient(ellipse 60% 50% at 30% 40%, var(--hero-c1) 0%, transparent 50%),
            radial-gradient(ellipse 50% 60% at 70% 60%, var(--hero-c3) 0%, transparent 50%)
          `,
        }} />

        {/* 積載分布ゲージ + 種類数 + 進捗率（右上 — 常時表示、バッジ行と同じ高さ） */}
        {allItems.length > 0 && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0,
          }}>
            {/* 棒ゲージ（右から収縮: row-reverse） */}
            <div style={{
              display: 'flex', flexDirection: 'row-reverse', width: 140, height: 22, borderRadius: 20,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(255,255,255,0.7)',
              boxShadow: '0 0 12px rgba(255,255,255,0.25), 0 0 24px rgba(255,255,255,0.1), inset 0 0 4px rgba(255,255,255,0.1)',
            }}>
              {Array.from(typeCounts.entries()).reverse().map(([typeKey, count]) => {
                const nabeBarColor = typeKey === '鍋100' ? '#22c55e' : typeKey === '鍋180' ? '#3b82f6' : null;
                const tc = nabeBarColor ? { accent: nabeBarColor } : (COLOR_MAP[typeKey as keyof typeof COLOR_MAP] || COLOR_MAP['その他']);
                const completedOfType = typeKey === '鍋100'
                  ? allItems.filter(it => it.type === '鍋' && !(it.itemName.includes('180') || /18[RWCS]/.test(it.itemName)) && completedIds.has(it.id)).length
                  : typeKey === '鍋180'
                  ? allItems.filter(it => it.type === '鍋' && (it.itemName.includes('180') || /18[RWCS]/.test(it.itemName)) && completedIds.has(it.id)).length
                  : allItems.filter(it => it.type === typeKey && completedIds.has(it.id)).length;
                const remainingOfType = count - completedOfType;
                const pct = (remainingOfType / allItems.length) * 100;
                return pct > 0 ? (
                  <div key={typeKey} style={{
                    width: `${pct}%`, height: '100%',
                    background: `linear-gradient(180deg, ${tc.accent}dd, ${tc.accent}88)`,
                    transition: 'width 0.5s ease',
                    borderLeft: '0.5px solid rgba(0,0,0,0.2)',
                  }} />
                ) : null;
              })}
            </div>
            {/* 種類+数 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
            }}>
              {Array.from(typeCounts.entries()).map(([typeKey, count]) => {
                const nabeBarColor = typeKey === '鍋100' ? '#22c55e' : typeKey === '鍋180' ? '#3b82f6' : null;
                const tc = nabeBarColor ? { accent: nabeBarColor } : (COLOR_MAP[typeKey as keyof typeof COLOR_MAP] || COLOR_MAP['その他']);
                const label = typeKey === '鍋100' ? '100' : typeKey === '鍋180' ? '180' : null;
                return (
                  <span key={typeKey} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tc.accent, display: 'inline-block' }} />
                    {label && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>{label}</span>}
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{count}</span>
                  </span>
                );
              })}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>/ {allItems.length}品</span>
            </div>
            {/* 進捗率 */}
            <span style={{
              fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 800, marginTop: 6,
              color: '#fff', letterSpacing: 0.5,
              textShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4), 0 0 40px rgba(255,255,255,0.2)',
            }}>
              {Math.round((completedIds.size / allItems.length) * 100)}%
            </span>
          </div>
        )}

        {/* 1行目: 種目バッジ + 色柄（常時表示） */}
        <div className="detail-badges">
          <span className="type-badge" style={{
            backgroundColor: `${accentColor}40`, color: '#fff',
            border: `1.5px solid ${accentColor}70`, fontWeight: 700, fontSize: 12,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: accentColor, display: 'inline-block' }} />
            {item.type}
          </span>
          {isCurrentNabe && (
            <span className="type-badge" style={{
              backgroundColor: (currentNabeIs180 ? '#3b82f6' : '#22c55e') + '40', color: '#fff',
              border: '1.5px solid ' + (currentNabeIs180 ? '#3b82f6' : '#22c55e') + '70', fontWeight: 700, fontSize: 12,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: currentNabeIs180 ? '#3b82f6' : '#22c55e', display: 'inline-block' }} />
              {currentNabeIs180 ? '180' : '100'}
            </span>
          )}
          {itemColor && (
            <span className="type-badge" style={{
              backgroundColor: itemColor === '黒' ? 'rgba(30,30,30,0.8)' : itemColor === '白' ? 'rgba(240,240,240,0.9)' : 'rgba(200,160,50,0.4)',
              color: itemColor === '黒' ? '#fff' : itemColor === '白' ? '#222' : '#ffe066',
              border: `1.5px solid ${itemColor === '黒' ? '#666' : itemColor === '白' ? '#ddd' : '#daa520'}`,
              fontWeight: 700, fontSize: 12,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                backgroundColor: itemColor === '黒' ? '#222' : itemColor === '白' ? '#fff' : '#daa520',
                border: `1.5px solid ${itemColor === '黒' ? '#888' : itemColor === '白' ? '#bbb' : '#b8860b'}`,
              }} />
              {itemColor}
            </span>
          )}
        </div>

        {/* トランジション制御ラッパー（品名・箱図・パレット・数量のみ対象） */}
        <div style={{
          opacity: upperOpacity, transition: upperTransition,
          visibility: showContent ? 'visible' : 'hidden',
          display: 'flex',
          flexDirection: 'column', gap: 4, flex: '1 1 0', minHeight: 0,
          position: 'relative', zIndex: 1,
        }}>

        {/* 品名（下から出現）— 右側の種類数表示と重ならないようwidth制限 */}
        <div key={`name-${animKey}`} className="anim-slide-up" style={{ position: 'relative', zIndex: 3, maxWidth: 'calc(100% - 130px)' }}>
          <MarqueeText text={displayItemName} className="detail-item-name"
            style={{
              color: nabeColor || '#f0f0f0',
              textShadow: `0 0 24px ${accentColor}60, 0 0 48px ${accentColor}25, 0 2px 6px rgba(0,0,0,0.8)`,
            }} />
          {/* 品名の下に気高コード（KTE青）+ 新建高コード（KEN赤）縦並び */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
            {item.partNumber && (
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)',
                letterSpacing: 0.5,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', letterSpacing: 1, marginRight: 4 }}>KTE</span>
                {item.partNumber}
              </span>
            )}
            {item.newPartNumber && (
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)',
                letterSpacing: 0.5,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: 1, marginRight: 4 }}>KEN</span>
                {item.newPartNumber}
              </span>
            )}
          </div>
        </div>

        {/* 箱イメージ + パレット図 */}
        <div className="detail-pallet-area" style={{
          position: 'relative', zIndex: 0, flex: '1 1 0', minHeight: 0,
          display: 'flex', flexDirection: 'row', gap: 2,
        }}>
          <div style={{ position: 'relative', flex: '0 0 28%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(item.measurements || item.cbm || item.type === '鍋') && (
              <div key={`box-${animKey}`} className="anim-zoom-in" style={{ width: '100%', height: '100%' }}>
                <SizeDiagram measurements={item.measurements} cbm={item.cbm} type={item.type} maxContainerDim={maxContainerDim} itemName={item.itemName} />
              </div>
            )}
            {currentDims && (
              <div key={`dims-${animKey}`} className="anim-fade-in" style={{
                position: 'absolute', bottom: 0, left: 2, zIndex: 10, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 11,
                color: accentColor, textShadow: `0 0 8px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,0.7)`, letterSpacing: '-0.3px', animationDelay: '2s',
              }}>{currentDims[0]}×{currentDims[1]}×{currentDims[2]}</div>
            )}
          </div>
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {displayPallets > 0 && item.qtyPerPallet > 0 && (
              /* タップで全画面表示（積む順番どおりに箱が降りてくる） */
              <div key={`pl-${animKey}`} style={{ flex: 1, height: '100%', minWidth: 0, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setFullscreenPallet('full'); }}>
                <PalletDiagram palletCount={displayPallets} fraction={0} qtyPerPallet={item.qtyPerPallet} type={item.type} itemName={item.itemName} measurements={item.measurements} wireframe={false} />
              </div>
            )}
            {inspectionDeducted > 0 && (
              <div key={`fr-${animKey}`} ref={fractionSrcRef} style={{
                flex: displayPallets > 0 ? '0 0 35%' : 1,
                height: displayPallets > 0 ? '75%' : '100%',
                minWidth: 0, cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
                onClick={(e) => { e.stopPropagation(); handleFractionTap(); }}>
                <PalletDiagram palletCount={0} fraction={inspectionDeducted} qtyPerPallet={item.qtyPerPallet} type={item.type} itemName={item.itemName} measurements={item.measurements} wireframe={false} />
              </div>
            )}
          </div>
        </div>

        {/* 数量（PL / CT / pcs）— zIndex高めで図の上に表示 */}
        <div key={`stats-${animKey}`} className="detail-stats-free" style={{ position: 'relative', zIndex: 10, justifyContent: 'center', flexShrink: 0 }}>
          <div className="detail-sf-item anim-slide-up" style={{ minWidth: 0 }}>
            <span className="detail-sf-num" onClick={handlePalletTap} style={{
              color: accentColor, textShadow: `0 0 16px ${accentColor}50, 0 2px 4px rgba(0,0,0,0.6)`,
              cursor: 'pointer', transition: 'background 0.15s ease',
              background: palletFlash ? 'rgba(255,255,255,0.25)' : 'transparent',
              borderRadius: 8, userSelect: 'none', display: 'inline-block', minWidth: '2.2ch', textAlign: 'right',
            }}>{fmtNum(animPL)}</span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              {item.qtyPerPallet > 0 && (
                <span key={`at-${animKey}`} style={{ fontSize: 13, color: accentColor, fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1, opacity: 0, animation: 'fadeIn 0.5s ease 1.5s forwards' }}>@{item.qtyPerPallet}</span>
              )}
              <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>PL</span>
            </span>
          </div>
          <div ref={ctStatRef} className="detail-sf-item anim-slide-up" style={{ minWidth: 0, animationDelay: '0.15s' }}>
            <span className="detail-sf-num" style={{ color: '#e8e8e8', textShadow: `0 0 16px ${accentColor}30, 0 2px 4px rgba(0,0,0,0.6)`, display: 'inline-block', minWidth: '2.2ch', textAlign: 'right' }}>{fmtNum(animCT)}</span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              {rawFraction > 0 && rawFraction !== inspectionDeducted && (
                <span key={`raw-${animKey}`} style={{ fontSize: 13, color: '#e8e8e8', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1, opacity: 0, animation: 'fadeIn 0.5s ease 1.8s forwards' }}>({rawFraction})</span>
              )}
              <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>CT</span>
            </span>
          </div>
          <div ref={pcsStatRef} className="detail-sf-item detail-sf-total anim-slide-up" style={{ minWidth: 0, animationDelay: '0.3s' }}>
            <span className="detail-sf-num-sm detail-sf-pcs" style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-block', textAlign: 'right' }}>{animPCS.toLocaleString()}</span>
            <span className="detail-sf-label" style={{ color: 'rgba(255,255,255,0.4)' }}>pcs</span>
          </div>
        </div>

        </div>{/* トランジション制御ラッパー閉じ */}

        {/* 類似品 or 関連（常時表示 — 下部固定） */}
        <div style={{ flexShrink: 0, minHeight: 32, zIndex: 2 }}>
          {similarItems.length > 0 ? (
            <SimilarItemsMarquee item={item} similarItems={similarItems} />
          ) : effectiveRelatedItems.length > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20,
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.12)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', flexShrink: 0 }}>関連:</span>
              <MarqueeText text={relatedText} className="detail-related-text" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500 }} />
            </div>
          ) : null}
        </div>
      </div>

      {/* === 下半分リスト === */}
      <div className="detail-list-section" style={{ background: '#1a1d2e' }}>
        <div className="detail-list-header" style={{ background: '#1e2130' }}>
          <span className="detail-list-h-name" style={{ color: 'rgba(255,255,255,0.6)' }}>品名</span>
          <span className="detail-list-h-num" style={{ color: 'rgba(255,255,255,0.6)' }}>PL</span>
          <span className="detail-list-h-num" style={{ color: 'rgba(255,255,255,0.6)' }}>CS</span>
          <span className="detail-list-h-num detail-list-h-total" style={{ color: 'rgba(255,255,255,0.6)' }}>PCS</span>
        </div>
        <div className="detail-list-scroll">
          {sortedItems.map((it) => {
            const c = COLOR_MAP[it.type] || COLOR_MAP['その他'];
            const isActive = it.id === item.id;
            const isDone = completedIds.has(it.id);
            const jpName = buildJapanesePartName(it);
            const displayName = jpName || shortenName(it.itemName);
            const origIdx = allItems.findIndex((a) => a.id === it.id);
            // 鍋は機種別カラーを使用
            const itNabeColor = getNabeModelColor(it.itemName, it.type);
            const itAccent = itNabeColor || c.accent;
            const typeBg = itNabeColor ? nabeColorToDarkBg(itNabeColor) : (TYPE_ROW_BG[it.type] || TYPE_ROW_BG['その他']);
            const rowBg = isDone ? '#1e1e22' : isActive ? '#2a1f10' : typeBg;

            const content = (
              <>
                <span className="detail-list-dot" style={{ backgroundColor: isDone ? '#555' : itAccent }} />
                <MarqueeText text={displayName}
                  className="detail-list-name"
                  style={isDone
                    ? { color: '#999', textDecoration: 'line-through' }
                    : isActive ? { fontWeight: 700, color: '#e67e00' } : { color: isLightMode ? '#1a1a2e' : (itNabeColor || 'rgba(255,255,255,0.85)') }
                  } />
                <span className="detail-list-num" style={{ color: isDone ? '#999' : isActive ? '#e67e00' : isLightMode ? '#1a6030' : itAccent, fontWeight: 600 }}>{fmtNum(it.palletCount)}</span>
                <span className="detail-list-num" style={{ color: isDone ? '#999' : isActive ? '#e67e00' : isLightMode ? '#1a1a2e' : 'rgba(255,255,255,0.7)' }}>{fmtNum(it.fraction)}</span>
                <span className="detail-list-num detail-list-total" style={{ color: isDone ? '#999' : isLightMode ? '#555' : 'rgba(255,255,255,0.55)' }}>
                  {Math.ceil(it.totalQty).toLocaleString()}
                </span>
              </>
            );

            if (isDone) {
              return (
                <UndoSwipeRow key={it.id}
                  onSwipe={() => onUncompleteItem?.(it.id)}
                  onClick={() => onUncompleteItem?.(it.id)}
                  className="detail-list-row"
                  style={{ background: rowBg, borderLeftColor: '#444', borderLeftWidth: 3 }}
                >{content}</UndoSwipeRow>
              );
            }

            // ライトモード用の明るい背景色
            const lightTypeBg: Record<string, string> = {
              'ポリカバー': '#e8f5e9', 'ジャーポット': '#f3e5f5', '箱': '#e3f2fd',
              '部品': '#ede7f6', '鍋': '#fff3e0', 'ヤーマン部品': '#fff8e1', 'その他': '#f5f5f5',
            };
            const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
            const finalRowBg = isLight
              ? (isDone ? '#f5f5f5' : isActive ? '#fff3d8' : (lightTypeBg[it.type] || '#f5f5f5'))
              : rowBg;

            return (
              <SwipeRow key={it.id}
                onSwipe={() => onCompleteItem?.(it.id)}
                className={`detail-list-row ${isActive ? 'active' : ''}`}
                style={{
                  background: finalRowBg,
                  borderLeftColor: isActive ? '#ff6d00' : itAccent,
                  borderLeftWidth: isActive ? 4 : 3,
                }}
              >
                <div style={{ display: 'contents' }} onClick={() => onSelectItem?.(origIdx)}>
                  {content}
                </div>
              </SwipeRow>
            );
          })}
          {/* リスト下部余白（最下行が見えるように） */}
          <div style={{ height: 60, flexShrink: 0 }} />
        </div>
      </div>

      {/* パレット全画面表示モーダル */}
      {/* 端数パレットのみになった時の全画面「積み方」表示
          元のパレット位置から回転しながらズームし、背景はガウスぼかし。
          横スワイプで回転（画面幅で180度）。触っていない間は速い回転から始まり作業画面と同じ速さに落ち着く。
          図の外をタップするとすぐ元に戻る。 */}
      {autoFs !== 'idle' && inspectionDeducted > 0 && (
        <div
          onPointerDown={handleAutoFsPointerDown}
          onPointerMove={handleAutoFsPointerMove}
          onPointerUp={handleAutoFsPointerUp}
          onPointerCancel={handleAutoFsPointerUp}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            // 背景は明るさを変えず、ガウスぼかしだけを掛ける
            background: 'transparent',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            opacity: autoFs === 'measure' || autoFs === 'out' ? 0 : 1,
            transition: `opacity ${autoFs === 'out' ? AUTO_FS_OUT_MS : AUTO_FS_IN_MS}ms ease`,
            touchAction: 'none', userSelect: 'none', cursor: 'grab',
          }}
        >
          <div ref={autoFsBoxRef} style={{
            width: '92vw', height: '58vh',
            pointerEvents: 'none',
            transformOrigin: 'center center',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            transform: (autoFs === 'in' || autoFs === 'show') || !autoFsFlip
              ? 'translate(0px, 0px) scale(1)'
              : `translate(${autoFsFlip.dx}px, ${autoFsFlip.dy}px) scale(${autoFsFlip.s})`,
            transition: autoFs === 'in'
              ? `transform ${AUTO_FS_IN_MS}ms cubic-bezier(0.33,0.1,0.2,1)`
              : autoFs === 'out'
                ? `transform ${AUTO_FS_OUT_MS}ms cubic-bezier(0.4,0,0.4,1)`
                : 'none',
            opacity: autoFs === 'measure' ? 0 : 1,
          }}>
            <div style={{
              width: '100%', height: '100%',
              transform: `scale(${autoFsScale})`, transformOrigin: 'center center',
              willChange: 'transform',
            }}>
              <PalletDiagram
                palletCount={0} fraction={inspectionDeducted}
                qtyPerPallet={item.qtyPerPallet} type={item.type} itemName={item.itemName}
                measurements={item.measurements} wireframe={false}
                overrideRotateY={autoFsRotRef.current}
                noIntro
              />
            </div>
          </div>
          <div style={{ marginTop: 8, textAlign: 'center', pointerEvents: 'none' }}>
            {/* 残りCT数は作業画面の CT 表示の位置・大きさから、図と一緒に下りてくる */}
            <div ref={autoFsCapRef} style={{
              transformOrigin: 'center center',
              willChange: 'transform',
              transform: (autoFs === 'in' || autoFs === 'show') || !autoFsCapFlip
                ? 'translate(0px, 0px) scale(1)'
                : `translate(${autoFsCapFlip.dx}px, ${autoFsCapFlip.dy}px) scale(${autoFsCapFlip.s})`,
              transition: autoFs === 'in'
                ? `transform ${AUTO_FS_IN_MS}ms cubic-bezier(0.33,0.1,0.2,1)`
                : autoFs === 'out'
                  ? `transform ${AUTO_FS_OUT_MS}ms cubic-bezier(0.4,0,0.4,1)`
                  : 'none',
              opacity: autoFs === 'measure' ? 0 : 1,
            }}>
              {/* 作業画面の CT 表示と同じ内容を、大きいサイズで見せる */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'clamp(56px, 20vw, 110px)',
                  fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: -3,
                  lineHeight: 0.78, color: '#fff',
                  textShadow: `0 0 26px ${accentColor}77, 0 3px 14px rgba(0,0,0,0.9)`,
                }}>
                  {fmtNum(animCT)}
                </span>
                <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  {rawFraction > 0 && rawFraction !== inspectionDeducted && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 'clamp(16px, 5vw, 26px)', fontWeight: 700,
                      lineHeight: 1, color: '#e8e8e8', textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                    }}>({rawFraction})</span>
                  )}
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 'clamp(18px, 6vw, 30px)', fontWeight: 700,
                    lineHeight: 1, color: 'rgba(255,255,255,0.75)', textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                  }}>CT</span>
                </span>
                {/* 総数（pcs）も作業画面と同じ内容で並べる */}
                <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 4, marginLeft: 10 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'clamp(26px, 9vw, 50px)', fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums', letterSpacing: -1, lineHeight: 0.85,
                    color: 'rgba(255,255,255,0.7)', textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                  }}>
                    {animPCS.toLocaleString()}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 'clamp(13px, 4.5vw, 22px)', fontWeight: 700,
                    lineHeight: 1.2, color: 'rgba(255,255,255,0.5)', textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                  }}>pcs</span>
                </span>
              </div>
            </div>
            {/* 補足の文字は移動後に浮かび上がらせる */}
            <div style={{
              opacity: autoFs === 'show' ? 1 : 0,
              transition: `opacity ${autoFs === 'out' ? AUTO_FS_OUT_MS / 2 : 400}ms ease`,
            }}>
              <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 11, textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                スワイプで回転／図の外をタップで戻る
              </p>
            </div>
          </div>
        </div>
      )}

      {fullscreenPallet && (
        <div
          onClick={() => {
            // ドラッグ中でなければ閉じる
            if (!fsTouchRef.current) { setFullscreenPallet(null); setFsRotateY(-35); }
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            fsTouchRef.current = { startX: e.touches[0].clientX, startRotY: fsRotateY };
          }}
          onTouchMove={(e) => {
            e.stopPropagation(); e.preventDefault();
            if (!fsTouchRef.current) return;
            setFsRotateY(fsTouchRef.current.startRotY + (e.touches[0].clientX - fsTouchRef.current.startX) * 0.5);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (fsTouchRef.current) {
              const dx = Math.abs(fsRotateY - fsTouchRef.current.startRotY);
              fsTouchRef.current = null;
              if (dx > 3) return; // ドラッグした場合はclickで閉じない
            }
          }}
          onMouseDown={(e) => { fsTouchRef.current = { startX: e.clientX, startRotY: fsRotateY }; }}
          onMouseMove={(e) => {
            if (!fsTouchRef.current || !e.buttons) return;
            setFsRotateY(fsTouchRef.current.startRotY + (e.clientX - fsTouchRef.current.startX) * 0.5);
          }}
          onMouseUp={() => {
            if (fsTouchRef.current) {
              const dx = Math.abs(fsRotateY - fsTouchRef.current.startRotY);
              fsTouchRef.current = null;
              if (dx > 3) return;
            }
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)',
            cursor: 'grab', touchAction: 'none',
            animation: 'fadeIn 0.3s ease both',
          }}
        >
          <div ref={fsBoxRef} style={{ width: '92vw', height: '78vh', pointerEvents: 'none' }}>
            <div style={{
              width: '100%', height: '100%',
              transform: `scale(${fsScale})`, transformOrigin: 'center center',
              willChange: 'transform',
            }}>
              <PalletDiagram
                palletCount={fullscreenPallet === 'full' ? item.palletCount : 0}
                fraction={fullscreenPallet === 'fraction' ? inspectionDeducted : 0}
                qtyPerPallet={item.qtyPerPallet} type={item.type} itemName={item.itemName}
                measurements={item.measurements} wireframe={false}
                overrideRotateY={fsRotateY}
                noIntro
                // パレットの図はまずパレットだけを出し、積む順番どおりに箱を降ろす
                stackAnim={fullscreenPallet === 'full'}
              />
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 32, color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
            スライドで回転 / タップで閉じる
          </div>
        </div>
      )}
    </div>
  );
}

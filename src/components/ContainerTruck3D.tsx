'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CONTAINER_SPECS, ContainerTypeKey } from '@/lib/containerLoad';

/**
 * コンテナを積んだトラックの立体図。
 * 透けたコンテナの中に、積んだぶんを色の塊で見せる。
 * パレット図と同じ CSS 3D なので、rotateX / rotateY をそのまま渡せば回る。
 *
 * 回すと見かけの大きさが変わるので、いまの角度での見かけの幅・高さを計算して、
 * 枠からはみ出さない倍率まで縮めてから描く。
 */

/** 積んだ物の内訳（種類ごと） */
export interface TruckSegment {
  /** 種類名 */
  key: string;
  /** 積んだ物ぜんぶに対する長さの割り当て 0〜1（全種類の合計が 1） */
  ratio: number;
  /** そのうち終わったぶんの割合 0〜1 */
  doneRatio: number;
  /** 色 */
  color: string;
}

interface ContainerTruck3DProps {
  containerType: ContainerTypeKey;
  /** 積んだ物の内訳。ratio の合計は 1（コンテナの長さいっぱいに割り当てる） */
  segments: TruckSegment[];
  /**
   * 積載率 0〜1。
   * 荷物は長さ方向にはいっぱいに積まれている前提で、高さで量を表す。
   * （実際、荷物は床いっぱいに広げて上に積み上げていくため）
   */
  fillRatio?: number;
  /** 図の横幅(px)。省略すると親の幅にあわせる */
  width?: number;
  /** 図の高さ。横幅に対する比。省略すると模型の形にあわせて決める */
  aspect?: number;
  rotateX?: number;
  rotateY?: number;
  /** 出てくるときのアニメーション（中身が伸びて現れる） */
  intro?: boolean;
  /**
   * 回転を React を通さずに当てるための取っ手。
   * ここに入る setAngles を毎フレーム呼べば、描き直しなしで transform だけを
   * 書き換えるので、指の動きに追いつく速さで回せる。
   */
  controllerRef?: React.MutableRefObject<TruckViewController | null>;
}

/** 回転を直接当てるための取っ手 */
export interface TruckViewController {
  /** 見る角度を当てる（React の描き直しは起きない） */
  setAngles(rotX: number, rotY: number): void;
}

/* ===== トラックの各部の実寸(mm) ===== */
/** 地面からコンテナの床まで */
const FLOOR_MM = 1420;
/** タイヤの直径 */
const TIRE_DIA_MM = 1080;
/** タイヤの幅 */
const TIRE_W_MM = 300;
/** シャーシの厚み */
const CHASSIS_H_MM = 200;
/** キャビンの長さ */
const CAB_LEN_MM = 2450;
/** 地面からキャビンの屋根まで */
const CAB_TOP_MM = 3450;
/** キャビンとコンテナの隙間 */
const CAB_GAP_MM = 350;
/** 図の左右の余白 */
const PAD_X_MM = 400;
/** 図の上下の余白 */
const PAD_TOP_MM = 300;
const PAD_BOTTOM_MM = 250;

/** mm → px（模型を組む時の倍率。最後に scale で合わせるので固定でよい） */
const MM2PX = 0.05;

const DEFAULT_ROT_X = -20;
const DEFAULT_ROT_Y = 30;

/** サーバー描画では useLayoutEffect が使えないので、そのときは useEffect にする */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ===== 3D の箱 ===== */
type FaceKey = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
type FaceStyles = Partial<Record<FaceKey | 'base', React.CSSProperties>>;
type FaceNodes = Partial<Record<FaceKey, React.ReactNode>>;

function Box3D({ x, y, z = 0, w, h, d, styles, faces, hide, extraTransform, wrapStyle }: {
  /** 左端(px) */ x: number;
  /** 上端(px) */ y: number;
  /** 奥行き方向の中心(px) */ z?: number;
  w: number; h: number; d: number;
  styles?: FaceStyles;
  faces?: FaceNodes;
  /** 描かない面 */ hide?: FaceKey[];
  /** translateZ のあとに足す変換（伸びるアニメーションなど） */ extraTransform?: string;
  wrapStyle?: React.CSSProperties;
}) {
  const s = styles || {};
  const skip = new Set(hide || []);
  const face = (k: FaceKey): React.CSSProperties => ({
    position: 'absolute', boxSizing: 'border-box', ...s.base, ...s[k],
  });

  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h,
      transformStyle: 'preserve-3d',
      transform: `translateZ(${z}px)${extraTransform ? ` ${extraTransform}` : ''}`,
      ...wrapStyle,
    }}>
      {!skip.has('front') && (
        <div style={{ ...face('front'), width: w, height: h, transform: `translateZ(${d / 2}px)` }}>{faces?.front}</div>
      )}
      {!skip.has('back') && (
        <div style={{ ...face('back'), width: w, height: h, transform: `rotateY(180deg) translateZ(${d / 2}px)` }}>{faces?.back}</div>
      )}
      {!skip.has('left') && (
        <div style={{ ...face('left'), width: d, height: h, left: (w - d) / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }}>{faces?.left}</div>
      )}
      {!skip.has('right') && (
        <div style={{ ...face('right'), width: d, height: h, left: (w - d) / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)` }}>{faces?.right}</div>
      )}
      {!skip.has('top') && (
        <div style={{ ...face('top'), width: w, height: d, top: (h - d) / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)` }}>{faces?.top}</div>
      )}
      {!skip.has('bottom') && (
        <div style={{ ...face('bottom'), width: w, height: d, top: (h - d) / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }}>{faces?.bottom}</div>
      )}
    </div>
  );
}

/* ===== タイヤ（何枚かの板を輪にして円筒に見せる） ===== */
function Wheel3D({ cx, cy, z, r, tw, segs = 8 }: {
  cx: number; cy: number; z: number; r: number; tw: number; segs?: number;
}) {
  // トレッドの1枚。円周方向の長さ = 2πr/segs、軸方向の幅 = タイヤ幅
  const stripW = (2 * Math.PI * r) / segs + 0.8;
  const strips = Array.from({ length: segs }, (_, i) => {
    const a = (360 / segs) * i;
    return (
      <div key={i} style={{
        position: 'absolute', left: cx - stripW / 2, top: cy - tw / 2,
        width: stripW, height: tw, boxSizing: 'border-box',
        transform: `translateZ(${z}px) rotateZ(${a}deg) translateY(${-r}px) rotateX(90deg)`,
        background: '#16181e',
        borderLeft: '0.5px solid rgba(255,255,255,0.06)',
      }} />
    );
  });

  const disc = (side: 1 | -1): React.ReactNode => (
    <div key={side} style={{
      position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2,
      borderRadius: '50%', boxSizing: 'border-box',
      transform: `translateZ(${z + (side * tw) / 2}px)`,
      background: '#1b1e25',
      border: '1px solid rgba(255,255,255,0.14)',
      backfaceVisibility: 'hidden',
    }}>
      {/* ホイール */}
      <div style={{
        position: 'absolute', inset: `${r * 0.34}px`, borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 34%, #6b7280, #3a3f4a 62%, #262a32)',
        border: '0.5px solid rgba(255,255,255,0.2)',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%', width: r * 0.32, height: r * 0.32,
        marginLeft: -r * 0.16, marginTop: -r * 0.16, borderRadius: '50%',
        background: '#8b929e',
      }} />
    </div>
  );

  return <>{strips}{disc(1)}{disc(-1)}</>;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * 色に明るさを掛けた色を返す。
 * CSS の filter: brightness() は面ごとに別の描画面を作らせてしまい、
 * 回している間ずっと描き直しが起きるので、色そのものを先に作っておく。
 */
function shade(color: string, mul: number): string {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * mul)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** ぎりぎりに詰めすぎないための余裕 */
const MARGIN = 1.02;
/** 遠近の強さ（模型の横幅に対する視点までの距離） */
const PERSPECTIVE_RATIO = 2.6;

interface Geometry { modelW: number; modelH: number; modelD: number; stageW: number; stageH: number }

/**
 * その角度で模型が画面上どれだけの幅・高さになるかを、
 * 箱の8つの角を実際に投影して求める。
 * 遠近法で手前の端がふくらむぶんも入るので、横向きにしても枠からはみ出さない。
 */
function projectSize(g: Geometry, rotY: number, rotX: number) {
  const cb = Math.cos(rad(rotY)), sb = Math.sin(rad(rotY));
  const ca = Math.cos(rad(rotX)), sa = Math.sin(rad(rotX));
  const d = g.modelW * PERSPECTIVE_RATIO;
  let maxX = 0, maxY = 0;
  for (const hx of [-g.modelW / 2, g.modelW / 2]) {
    for (const hy of [-g.modelH / 2, g.modelH / 2]) {
      for (const hz of [-g.modelD / 2, g.modelD / 2]) {
        // CSS の rotateX(rotX) rotateY(rotY) と同じ順で回す
        const x1 = hx * cb + hz * sb;
        const z1 = -hx * sb + hz * cb;
        const y2 = hy * ca - z1 * sa;
        const z2 = hy * sa + z1 * ca;
        // 遠近法（手前ほど大きく）。視点に近づきすぎたときは頭打ちにする
        const k = d / Math.max(d - z2, d * 0.25);
        maxX = Math.max(maxX, Math.abs(x1 * k));
        maxY = Math.max(maxY, Math.abs(y2 * k));
      }
    }
  }
  return { w: maxX * 2, h: maxY * 2 };
}

/** 枠に収まる倍率 */
function fitScale(g: Geometry, rotY: number, rotX: number): number {
  const p = projectSize(g, rotY, rotX);
  return Math.min(g.stageW / (p.w * MARGIN), g.stageH / (p.h * MARGIN));
}

export default function ContainerTruck3D({
  containerType, segments, width, aspect, fillRatio = 1,
  rotateX = DEFAULT_ROT_X, rotateY = DEFAULT_ROT_Y,
  intro = false, controllerRef,
}: ContainerTruck3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  /** 倍率をかけている入れ物と、回している入れ物。transform を直接書き換える */
  const scaleElRef = useRef<HTMLDivElement | null>(null);
  const sceneElRef = useRef<HTMLDivElement | null>(null);

  /** 模型の寸法。setAngles から読む */
  const geomRef = useRef<Geometry>({ modelW: 0, modelH: 0, modelD: 0, stageW: 0, stageH: 0 });
  /** 直接当てている角度。描き直しのあとに当て直すために覚えておく */
  const liveAnglesRef = useRef<{ x: number; y: number } | null>(null);
  const [autoW, setAutoW] = useState(width || 320);
  const [revealed, setRevealed] = useState(!intro);

  useIsomorphicLayoutEffect(() => {
    if (width) { setAutoW(width); return; }
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setAutoW(Math.max(160, el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    if (!intro) { setRevealed(true); return; }
    setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 80);
    return () => clearTimeout(t);
  }, [intro, containerType]);

  /* 回転を直接当てる取っ手を親に渡す */
  const applyAngles = useCallback((rx: number, ry: number) => {
    liveAnglesRef.current = { x: rx, y: ry };
    const g = geomRef.current;
    if (g.stageW <= 0 || g.stageH <= 0) return;
    const f = fitScale(g, ry, rx);
    if (scaleElRef.current) scaleElRef.current.style.transform = `scale(${f})`;
    if (sceneElRef.current) sceneElRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  }, []);

  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = { setAngles: applyAngles };
    return () => { controllerRef.current = null; };
  }, [controllerRef, applyAngles]);

  // 描き直しが入ると props の角度に戻ってしまうので、直接当てていた角度をかけ直す
  useEffect(() => {
    const a = liveAnglesRef.current;
    if (a) applyAngles(a.x, a.y);
  });

  const spec = CONTAINER_SPECS[containerType] || CONTAINER_SPECS['40HQ'];
  const px = (v: number) => v * MM2PX;

  /* ===== 模型の大きさ（固定倍率） ===== */
  const modelWmm = PAD_X_MM + CAB_LEN_MM + CAB_GAP_MM + spec.lengthMm + PAD_X_MM;
  const modelHmm = PAD_TOP_MM + Math.max(CAB_TOP_MM, FLOOR_MM + spec.heightMm) + PAD_BOTTOM_MM;
  const modelW = px(modelWmm);
  const modelH = px(modelHmm);
  const modelD = px(spec.widthMm);

  /* ===== いまの角度での見かけの大きさから、枠に収まる倍率を出す ===== */
  // 高さの指定がなければ、はじめの角度での形にあわせる。
  // 20ft のような短いコンテナでも枠の横幅いっぱいに描ける。
  // 回している間に枠の高さが変わらないよう、既定の角度で決め打ちする
  const sizeOnly: Geometry = { modelW, modelH, modelD, stageW: autoW, stageH: 0 };
  const base = projectSize(sizeOnly, DEFAULT_ROT_Y, DEFAULT_ROT_X);
  const autoAspect = Math.min(0.9, Math.max(0.3, base.h / base.w));
  const stageH = autoW * (aspect ?? autoAspect);
  const geom: Geometry = { modelW, modelH, modelD, stageW: autoW, stageH };
  geomRef.current = geom;
  const fit = fitScale(geom, rotateY, rotateX);
  // 線の太さは倍率が変わるたびに変えると描き直しになるので、既定の角度で決める
  const baseFit = fitScale(geom, DEFAULT_ROT_Y, DEFAULT_ROT_X);

  /* ===== 各部の位置(px) ===== */
  const groundY = modelH - px(PAD_BOTTOM_MM);
  const cabX = px(PAD_X_MM);
  const cabW = px(CAB_LEN_MM);
  const cabTopY = groundY - px(CAB_TOP_MM);
  const cabH = px(CAB_TOP_MM - 640);

  const conX = cabX + cabW + px(CAB_GAP_MM);
  const conW = px(spec.lengthMm);
  const conD = px(spec.widthMm);
  const conH = px(spec.heightMm);
  const conY = groundY - px(FLOOR_MM) - conH;

  const chassisY = groundY - px(FLOOR_MM);
  const chassisH = px(CHASSIS_H_MM);
  const tireR = px(TIRE_DIA_MM) / 2;
  const tireW = px(TIRE_W_MM);
  const axleY = groundY - tireR;

  // 車軸。キャビン2軸＋シャーシ側は 40ft が3軸、20ft の短いシャーシは2軸
  const trailerAxles = spec.lengthMm >= 8000 ? 3 : 2;
  const axles = [
    cabX + px(950),
    cabX + cabW + px(200),
    ...Array.from({ length: trailerAxles }, (_, i) => conX + conW - px(1150 + i * 1350)),
  ];

  const ribPitch = Math.max(3, px(305));
  const lineW = Math.max(0.5, 0.7 / Math.max(baseFit, 0.05));

  /* ===== 積んだぶんの塊 ===== */
  const wall = px(70);
  const innerX = conX + wall;
  const innerY = conY + wall;
  const innerW = conW - wall * 2;
  const innerH = conH - wall * 2;
  const innerD = conD - wall * 2;

  // 積んだ量は高さで表す。長さ方向はいっぱいまで使う
  const fill = Math.min(1, Math.max(0, fillRatio));
  // 少しでも積んでいれば見えるように、最低限の高さは残す
  const cargoH = fill > 0 ? Math.max(innerH * fill, Math.min(innerH, px(150))) : 0;
  const cargoY = innerY + innerH - cargoH;
  const ratioSum = segments.reduce((s, seg) => s + Math.max(0, seg.ratio), 0) || 1;
  // 量の少ない種類も細い板として見えるように、最低限の長さを与える
  const MIN_SEG = 0.012;

  // 格子は大きく見える面（手前・奥・天面）だけに入れる。
  // グラデーションは描くのに手間がかかるので、細い面は無地にする
  const gridPitch = Math.max(5, px(360));
  const cargoGrid = `
      repeating-linear-gradient(90deg, rgba(0,0,0,0.16) 0 0.5px, transparent 0.5px ${gridPitch}px),
      repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 0.5px, transparent 0.5px ${gridPitch}px),`;
  // 終わったぶん（dim）は透かさずに暗い同系色で描く。
  // 暗い背景で opacity を下げると、空のコンテナと見分けが付かなくなるため
  const cargoFace = (color: string, dim: boolean, bright: number, grid: boolean): React.CSSProperties => ({
    background: `${grid ? cargoGrid : ''} ${shade(color, bright * (dim ? 0.34 : 1))}`,
    border: `0.5px solid rgba(255,255,255,${dim ? 0.14 : 0.25})`,
    backfaceVisibility: 'hidden',
  });

  const cargoStyles = (color: string, dim: boolean): FaceStyles => ({
    base: cargoFace(color, dim, 1, false),
    front: cargoFace(color, dim, 1, true),
    top: cargoFace(color, dim, 1.3, true),
    back: cargoFace(color, dim, 0.62, true),
    bottom: cargoFace(color, dim, 0.45, false),
    // 細い板になったとき端の面が目立ちすぎないよう、暗めにしておく
    left: cargoFace(color, dim, 0.55, false),
    right: cargoFace(color, dim, 0.62, false),
  });

  const growStyle: React.CSSProperties = {
    transformOrigin: 'left center',
    transition: 'transform 1.1s cubic-bezier(0.22,1,0.36,1) 0.3s',
  };

  const cargoBoxes: React.ReactNode[] = [];
  if (cargoH > 0) {
    // 最低限の長さを配ったうえで、残りを量に応じて割り振る
    const shares = segments.map((seg) => Math.max(0, seg.ratio) / ratioSum);
    const spare = Math.max(0, 1 - MIN_SEG * shares.length);
    const parts = segments.map((seg, i) => {
      const segW = (MIN_SEG + shares[i] * spare) * innerW;
      const doneW = segW * Math.min(1, Math.max(0, seg.doneRatio));
      return { seg, restW: segW - doneW, doneW };
    });

    // 扉（右）から降ろしていくので、まだ残っているぶんを鼻側にまとめ、
    // 終わったぶんを扉側にまとめる。こうすると境目が1本になり、人の立ち位置と合う
    // 降ろし終えたぶんは低く敷くだけにする。上が空くので、
    // どこまで降ろせたかが見えたまま、人が入れる空間ができる
    const doneH = Math.min(cargoH, Math.max(px(250), cargoH * 0.2));
    const box = (seg: TruckSegment, x: number, w: number, dim: boolean) => (
      <Box3D key={`${seg.key}-${dim ? 'done' : 'rest'}`}
        x={x} y={dim ? cargoY + cargoH - doneH : cargoY}
        w={w} h={dim ? doneH : cargoH} d={innerD}
        styles={cargoStyles(seg.color, dim)}
        hide={['bottom']}
        extraTransform={`scaleX(${revealed ? 1 : 0.001})`}
        wrapStyle={growStyle}
      />
    );

    let cum = 0;
    for (const p of parts) {
      if (p.restW > 0.3) cargoBoxes.push(box(p.seg, innerX + cum, p.restW, false));
      cum += p.restW;
    }
    for (const p of parts) {
      if (p.doneW > 0.3) cargoBoxes.push(box(p.seg, innerX + cum, p.doneW, true));
      cum += p.doneW;
    }
  }

  /* ===== コンテナ（透ける箱） ===== */
  const glassRib = `repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 ${lineW}px, transparent ${lineW}px ${ribPitch}px),`;
  const glassFace = (alpha: number, rib = true): React.CSSProperties => ({
    background: `${rib ? glassRib : ''} rgba(186,202,225,${alpha})`,
    border: `${lineW * 1.4}px solid rgba(255,255,255,0.55)`,
    backfaceVisibility: 'visible',
  });

  return (
    <div ref={hostRef} style={{ width: width ? width : '100%' }}>
      <div style={{
        position: 'relative', width: '100%', height: stageH, overflow: 'visible',
      }}>
        <div ref={scaleElRef} style={{
          position: 'absolute', left: '50%', top: '50%',
          width: modelW, height: modelH, marginLeft: -modelW / 2, marginTop: -modelH / 2,
          transform: `scale(${fit})`,
          perspective: `${modelW * PERSPECTIVE_RATIO}px`,
          willChange: 'transform',
        }}>
          <div ref={sceneElRef} style={{
            position: 'absolute', inset: 0,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transformOrigin: '50% 50%',
            willChange: 'transform',
          }}>
            {/* 地面の影 */}
            <div style={{
              position: 'absolute', left: cabX - px(600), top: groundY - conD / 2,
              width: conX + conW + px(600) - cabX, height: conD * 1.25,
              transform: `rotateX(90deg) translateZ(${-tireR * 2 + 1}px)`,
              background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.6), rgba(0,0,0,0) 72%)',
              pointerEvents: 'none',
            }} />

            {/* シャーシ */}
            <Box3D x={cabX + px(500)} y={chassisY}
              w={conX + conW - cabX - px(500)} h={chassisH} d={conD * 0.6}
              hide={['bottom']}
              styles={{
                base: { background: '#20232b', border: '0.5px solid rgba(255,255,255,0.07)' },
                top: { background: '#2c3039' },
                front: { background: 'linear-gradient(180deg,#333844,#1b1e25)' },
              }}
            />

            {/* 車軸とタイヤ */}
            {axles.map((ax, i) => (
              <React.Fragment key={`axle-${i}`}>
                <Box3D x={ax - px(160)} y={axleY - px(120)}
                  w={px(320)} h={px(240)} d={conD * 0.86}
                  hide={['bottom', 'left', 'right']}
                  styles={{ base: { background: '#191c22' }, top: { background: '#23262e' } }} />
                <Wheel3D cx={ax} cy={axleY} z={conD / 2 - tireW / 2} r={tireR} tw={tireW} />
                <Wheel3D cx={ax} cy={axleY} z={-conD / 2 + tireW / 2} r={tireR} tw={tireW} />
              </React.Fragment>
            ))}

            {/* キャビン */}
            <Box3D x={cabX} y={cabTopY} w={cabW} h={cabH} d={conD * 0.94}
              hide={['bottom']}
              styles={{
                base: { background: '#1f222a', border: '0.5px solid rgba(255,255,255,0.10)' },
                front: { background: 'linear-gradient(180deg,#2f333d 0%,#1e2128 60%,#171a20 100%)' },
                top: { background: 'linear-gradient(180deg,#3b4049,#262a33)' },
                left: { background: 'linear-gradient(180deg,#2b2f38,#181b21)' },
                right: { background: '#191c22' },
                back: { background: '#14161b' },
              }}
              faces={{
                front: (
                  <>
                    {/* サイドの窓 */}
                    <div style={{
                      position: 'absolute', left: '10%', top: '14%', width: '38%', height: '30%',
                      background: 'linear-gradient(160deg, rgba(150,190,235,0.28), rgba(60,90,130,0.10))',
                      border: '0.5px solid rgba(255,255,255,0.18)', borderRadius: px(100),
                    }} />
                    {/* ドアの筋 */}
                    <div style={{
                      position: 'absolute', left: '52%', top: '8%', width: 0, height: '70%',
                      borderLeft: '0.5px solid rgba(255,255,255,0.10)',
                    }} />
                  </>
                ),
                left: (
                  <>
                    {/* フロントガラス */}
                    <div style={{
                      position: 'absolute', left: '10%', top: '12%', width: '80%', height: '34%',
                      background: 'linear-gradient(165deg, rgba(160,200,240,0.34), rgba(60,90,130,0.12))',
                      border: '0.5px solid rgba(255,255,255,0.22)', borderRadius: px(120),
                    }} />
                    {/* ヘッドライト */}
                    <div style={{
                      position: 'absolute', left: '12%', top: '68%', width: '30%', height: '11%',
                      background: 'rgba(248,232,64,0.8)', borderRadius: px(60),
                    }} />
                    <div style={{
                      position: 'absolute', left: '58%', top: '68%', width: '30%', height: '11%',
                      background: 'rgba(248,232,64,0.8)', borderRadius: px(60),
                    }} />
                    <div style={{
                      position: 'absolute', left: '12%', top: '84%', width: '76%', height: '8%',
                      background: 'rgba(249,115,22,0.5)', borderRadius: px(60),
                    }} />
                  </>
                ),
              }}
            />

            {/* コンテナの中身 */}
            {cargoBoxes}

            {/* コンテナ（透ける） */}
            <Box3D x={conX} y={conY} w={conW} h={conH} d={conD}
              styles={{
                base: glassFace(0.05),
                top: glassFace(0.04),
                bottom: { ...glassFace(0.05, false), background: 'rgba(120,132,150,0.2)' },
                back: glassFace(0.035),
                right: glassFace(0.09, false),
                left: glassFace(0.07, false),
              }}
            />

            {/* コンテナの角柱（骨組みを目立たせる） */}
            {[conX, conX + conW - px(100)].map((bx, i) => (
              <React.Fragment key={`post-${i}`}>
                {[conD / 2, -conD / 2].map((zz, j) => (
                  <div key={j} style={{
                    position: 'absolute', left: bx, top: conY, width: px(100), height: conH,
                    transform: `translateZ(${zz}px)`,
                    background: 'rgba(226,235,248,0.45)',
                  }} />
                ))}
              </React.Fragment>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  /** コンテナの長さに対する割合 0〜1 */
  ratio: number;
  /** そのうち終わったぶんの割合 0〜1 */
  doneRatio: number;
  /** 色 */
  color: string;
}

interface ContainerTruck3DProps {
  containerType: ContainerTypeKey;
  /** 積んだ物の内訳。ratio の合計が積載率になる */
  segments: TruckSegment[];
  /** 図の横幅(px)。省略すると親の幅にあわせる */
  width?: number;
  /** 図の高さ。横幅に対する比。省略時 0.5 */
  aspect?: number;
  rotateX?: number;
  rotateY?: number;
  /** 寸法線を描く */
  showDims?: boolean;
  /** 出てくるときのアニメーション（中身が伸びて現れる） */
  intro?: boolean;
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
/** 図の左の余白 */
const PAD_LEFT_MM = 700;
/** 図の右の余白（高さの寸法線と文字ぶん） */
const PAD_RIGHT_MM = 2600;
/** 図の上下の余白 */
const PAD_TOP_MM = 1300;
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
function Wheel3D({ cx, cy, z, r, tw, segs = 12 }: {
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

/* ===== 寸法線 ===== */
function DimLine({ horizontal, length, label, thickness, font, place = 'center', textRotate = 0, mirror = false }: {
  horizontal: boolean; length: number; label: string; thickness: number; font: number;
  /** 文字の置き方。center=線の真ん中、after=線の外側（横線なら下、縦線なら右） */
  place?: 'center' | 'after';
  /** 文字だけ回す */
  textRotate?: number;
  /** 裏から見ているとき、文字が鏡文字にならないよう反転する */
  mirror?: boolean;
}) {
  const flip = mirror ? ' scaleX(-1)' : '';
  const head = thickness * 3.5;
  const arrow = (rot: number): React.CSSProperties => ({
    position: 'absolute',
    width: 0, height: 0,
    borderStyle: 'solid',
    borderWidth: `${head}px ${head * 1.7}px ${head}px 0`,
    borderColor: 'transparent rgba(255,255,255,0.9) transparent transparent',
    transform: `rotate(${rot}deg)`,
  });
  const textBase: React.CSSProperties = {
    position: 'absolute',
    fontSize: font, fontWeight: 700, whiteSpace: 'nowrap',
    color: '#fff', letterSpacing: 0.2, lineHeight: 1.1,
    textShadow: '0 1px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.95)',
  };

  if (horizontal) {
    const text: React.CSSProperties = place === 'center'
      ? { ...textBase, left: '50%', top: '50%', transform: `translate(-50%,-50%) rotate(${textRotate}deg)${flip}`, padding: `${thickness}px ${thickness * 3}px` }
      : { ...textBase, left: '50%', top: '100%', transform: `translate(-50%, ${thickness}px) rotate(${textRotate}deg)${flip}` };
    return (
      <div style={{ position: 'absolute', left: 0, top: 0, width: length, height: head * 2 }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%',
          height: thickness, background: 'rgba(255,255,255,0.8)', transform: 'translateY(-50%)',
        }} />
        <div style={{ ...arrow(0), left: 0, top: '50%', marginTop: -head }} />
        <div style={{ ...arrow(180), right: 0, top: '50%', marginTop: -head }} />
        <span style={text}>{label}</span>
      </div>
    );
  }
  const text: React.CSSProperties = place === 'center'
    ? { ...textBase, left: '50%', top: '50%', transform: `translate(-50%,-50%) rotate(${textRotate}deg)${flip}`, padding: `${thickness * 2}px ${thickness * 2}px` }
    : { ...textBase, left: '100%', top: '50%', transform: `translate(${thickness * 3}px, -50%) rotate(${textRotate}deg)${flip}`, transformOrigin: 'left center' };
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: head * 2, height: length }}>
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '50%',
        width: thickness, background: 'rgba(255,255,255,0.8)', transform: 'translateX(-50%)',
      }} />
      <div style={{ ...arrow(90), top: 0, left: '50%', marginLeft: -head }} />
      <div style={{ ...arrow(-90), bottom: 0, left: '50%', marginLeft: -head }} />
      <span style={text}>{label}</span>
    </div>
  );
}

/** 桁区切りつきの mm 表記 */
function mmLabel(v: number): string {
  return `${v.toLocaleString('en-US')}mm`;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export default function ContainerTruck3D({
  containerType, segments, width, aspect = 0.5,
  rotateX = DEFAULT_ROT_X, rotateY = DEFAULT_ROT_Y,
  showDims = true, intro = false,
}: ContainerTruck3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
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

  const spec = CONTAINER_SPECS[containerType] || CONTAINER_SPECS['40HQ'];
  const px = (v: number) => v * MM2PX;

  /* ===== 模型の大きさ（固定倍率） =====
   * 寸法線を描かないときは余白を詰めて、図を大きく見せる */
  const padLeft = showDims ? PAD_LEFT_MM : 400;
  const padRight = showDims ? PAD_RIGHT_MM : 400;
  const padTop = showDims ? PAD_TOP_MM : 300;
  const modelWmm = padLeft + CAB_LEN_MM + CAB_GAP_MM + spec.lengthMm + padRight;
  const modelHmm = padTop + Math.max(CAB_TOP_MM, FLOOR_MM + spec.heightMm) + PAD_BOTTOM_MM;
  const modelW = px(modelWmm);
  const modelH = px(modelHmm);
  const modelD = px(spec.widthMm);

  /* ===== いまの角度での見かけの大きさから、枠に収まる倍率を出す ===== */
  const stageH = autoW * aspect;
  const cy = Math.abs(Math.cos(rad(rotateY)));
  const sy = Math.abs(Math.sin(rad(rotateY)));
  const cx = Math.abs(Math.cos(rad(rotateX)));
  const sx = Math.abs(Math.sin(rad(rotateX)));
  const projW = modelW * cy + modelD * sy;
  const projH = modelH * cx + modelW * sy * sx + modelD * cy * sx;
  // 遠近法で手前がふくらむぶんの余裕
  const MARGIN = 1.06;
  const fit = Math.min(autoW / (projW * MARGIN), stageH / (projH * MARGIN));

  /* ===== 各部の位置(px) ===== */
  const groundY = modelH - px(PAD_BOTTOM_MM);
  const cabX = px(padLeft);
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

  // 車軸（キャビン2軸＋シャーシ3軸）
  const axles = [
    cabX + px(950),
    cabX + cabW + px(200),
    conX + conW - px(1150),
    conX + conW - px(2500),
    conX + conW - px(3850),
  ];

  // 縮めたあとに読める太さ・文字の大きさにする
  const dimT = Math.max(0.6, 1.1 / Math.max(fit, 0.05));
  const dimFont = Math.max(6, 12 / Math.max(fit, 0.05));
  const ribPitch = Math.max(3, px(305));
  // 裏側から見ているときは寸法の文字が鏡文字になるので反転させる
  const dimMirror = Math.cos(rad(rotateY)) < 0;
  const lineW = Math.max(0.5, 0.7 / Math.max(fit, 0.05));

  /* ===== 積んだぶんの塊 ===== */
  const wall = px(70);
  const innerX = conX + wall;
  const innerY = conY + wall;
  const innerW = conW - wall * 2;
  const innerH = conH - wall * 2;
  const innerD = conD - wall * 2;

  const loadRatio = segments.reduce((s, seg) => s + Math.max(0, seg.ratio), 0);
  const drawRatio = Math.min(loadRatio, 1);
  // 100% を超えたぶんは描けないので、描く幅だけ縮める
  const shrink = loadRatio > 0 ? drawRatio / loadRatio : 0;

  const cargoFace = (color: string, dim: boolean, bright: number): React.CSSProperties => ({
    background: `
      repeating-linear-gradient(90deg, rgba(0,0,0,0.16) 0 0.5px, transparent 0.5px ${Math.max(5, px(360))}px),
      repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 0.5px, transparent 0.5px ${Math.max(5, px(360))}px),
      ${color}`,
    filter: `brightness(${bright})`,
    opacity: dim ? 0.3 : 1,
    border: `0.5px solid rgba(255,255,255,${dim ? 0.1 : 0.25})`,
    backfaceVisibility: 'hidden',
  });

  const cargoStyles = (color: string, dim: boolean): FaceStyles => ({
    base: cargoFace(color, dim, 1),
    front: cargoFace(color, dim, 1),
    top: cargoFace(color, dim, 1.3),
    back: cargoFace(color, dim, 0.62),
    bottom: cargoFace(color, dim, 0.45),
    left: cargoFace(color, dim, 0.82),
    right: cargoFace(color, dim, 0.95),
  });

  const growStyle: React.CSSProperties = {
    transformOrigin: 'left center',
    transition: 'transform 1.1s cubic-bezier(0.22,1,0.36,1) 0.3s',
  };

  const cargoBoxes: React.ReactNode[] = [];
  let cum = 0;
  for (const seg of segments) {
    const segW = Math.max(0, seg.ratio) * shrink * innerW;
    if (segW <= 0) continue;
    const doneW = segW * Math.min(1, Math.max(0, seg.doneRatio));
    const restW = segW - doneW;
    // 残りを鼻側に、終わったぶんを扉側に置く（扉から降ろすので扉側から減っていく）
    if (restW > 0.4) {
      cargoBoxes.push(
        <Box3D key={`${seg.key}-rest`} x={innerX + cum} y={innerY}
          w={restW} h={innerH} d={innerD}
          styles={cargoStyles(seg.color, false)}
          extraTransform={`scaleX(${revealed ? 1 : 0.001})`}
          wrapStyle={growStyle}
        />
      );
    }
    if (doneW > 0.4) {
      cargoBoxes.push(
        <Box3D key={`${seg.key}-done`} x={innerX + cum + restW} y={innerY}
          w={doneW} h={innerH} d={innerD}
          styles={cargoStyles(seg.color, true)}
          extraTransform={`scaleX(${revealed ? 1 : 0.001})`}
          wrapStyle={growStyle}
        />
      );
    }
    cum += segW;
  }

  /* ===== コンテナ（透ける箱） ===== */
  const glassFace = (alpha: number): React.CSSProperties => ({
    background: `
      repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 ${lineW}px, transparent ${lineW}px ${ribPitch}px),
      repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 ${lineW}px, transparent ${lineW}px ${ribPitch * 1.8}px),
      rgba(186,202,225,${alpha})`,
    border: `${lineW * 1.4}px solid rgba(255,255,255,0.55)`,
    backfaceVisibility: 'visible',
  });

  /* 天面に寸法線（長さ・幅）を乗せる。回しても模型と一緒に動く */
  const roofDims: React.ReactNode = showDims ? (
    /* 幅 — 天面の扉側の外に出す */
    <div style={{ position: 'absolute', left: conW + px(450), top: 0, height: conD }}>
      <DimLine horizontal={false} length={conD} label={mmLabel(spec.widthMm)}
        thickness={dimT} font={dimFont} place="after" mirror={dimMirror} />
    </div>
  ) : null;

  return (
    <div ref={hostRef} style={{ width: width ? width : '100%' }}>
      <div style={{
        position: 'relative', width: '100%', height: stageH, overflow: 'visible',
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: modelW, height: modelH, marginLeft: -modelW / 2, marginTop: -modelH / 2,
          transform: `scale(${fit})`,
          perspective: `${modelW * 2.6}px`,
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transformOrigin: '50% 50%',
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
                  styles={{ base: { background: '#191c22' }, top: { background: '#23262e' } }} />
                <Wheel3D cx={ax} cy={axleY} z={conD / 2 - tireW / 2} r={tireR} tw={tireW} />
                <Wheel3D cx={ax} cy={axleY} z={-conD / 2 + tireW / 2} r={tireR} tw={tireW} />
              </React.Fragment>
            ))}

            {/* キャビン */}
            <Box3D x={cabX} y={cabTopY} w={cabW} h={cabH} d={conD * 0.94}
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
                bottom: { ...glassFace(0.05), background: 'rgba(120,132,150,0.2)' },
                back: glassFace(0.035),
                right: glassFace(0.09),
                left: glassFace(0.07),
              }}
              faces={{ top: roofDims }}
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

            {/* 長さの寸法線（手前の面と平行に、屋根の上へ置く） */}
            {showDims && (
              <div style={{
                position: 'absolute', left: conX, top: conY - px(1150), width: conW,
                transform: `translateZ(${conD / 2}px)`,
              }}>
                <DimLine horizontal length={conW} label={mmLabel(spec.lengthMm)}
                  thickness={dimT} font={dimFont} mirror={dimMirror} />
              </div>
            )}

            {/* 高さの寸法線（手前の面と平行に、扉のうしろへ置く） */}
            {showDims && (
              <div style={{
                position: 'absolute', left: conX + conW + px(600), top: conY, height: conH,
                transform: `translateZ(${conD / 2}px)`,
              }}>
                <DimLine horizontal={false} length={conH} label={mmLabel(spec.heightMm)}
                  thickness={dimT} font={dimFont} place="after" mirror={dimMirror} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

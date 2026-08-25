'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContainerItem } from '@/lib/types';
import { buildLoadFigureData, LoadLegend, LoadStatCard } from './ContainerLoadFigure';
import ContainerTruck3D, { TruckViewController } from './ContainerTruck3D';

/**
 * コンテナ積載状況の全画面表示。
 * パレット図の全画面と同じで、スワイプで回転、図の外をタップで閉じる。
 * 上下のスワイプで見下ろす角度も変えられる。
 *
 * 回転はカクつきやすいので、React の状態を通さない。
 * 指の位置は ref にためておき、1フレームに1回だけ角度を確定して
 * 図の transform を直接書き換える（描き直しが起きないので指に追いつく）。
 */

/** はじめの見る角度 */
const ROT_Y0 = 30;
const ROT_X0 = -20;
/** 見下ろす角度の限界 */
const ROT_X_MIN = -75;
const ROT_X_MAX = 12;
/** 触っていない間はゆっくり回る（度/秒） */
const AUTO_SPIN_DPS = 8;
/** 触るのをやめてから自動回転に戻るまで(ms) */
const AUTO_SPIN_DELAY_MS = 1600;
/** 上下に重ねる見出し・凡例のぶん */
const CHROME_PX = 176;
/** スワイプの効き。画面の横幅いっぱいで約1回転 */
const SWIPE_DEG_PER_PX = 0.5;
const TILT_DEG_PER_PX = 0.3;

interface Props {
  items: ContainerItem[];
  completedIds: Set<string>;
  containerNo?: string;
  onClose: () => void;
}

interface Layout {
  /** 図の横幅(px) */
  figW: number;
  /** 図の高さの比 */
  aspect: number;
}

function measureLayout(): Layout {
  if (typeof window === 'undefined') return { figW: 320, aspect: 0.5 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const figW = Math.max(240, vw);
  const availH = Math.max(160, vh - CHROME_PX);
  // 横幅で決まる大きさなので、枠を高くしても図は大きくならない。
  // 回して縦に伸びたぶんが入る程度にとどめ、余白を作りすぎないようにする
  return { figW, aspect: Math.min(0.85, Math.max(0.35, availH / figW)) };
}

export default function ContainerLoadFullscreen({ items, completedIds, containerNo, onClose }: Props) {
  const [layout, setLayout] = useState<Layout>({ figW: 320, aspect: 0.5 });

  /** 図の取っ手。ここへ角度を流し込む */
  const truckRef = useRef<TruckViewController | null>(null);
  /** いま当てている角度 */
  const angleRef = useRef({ x: ROT_X0, y: ROT_Y0 });
  /** 指を下ろした位置と、そのときの角度 */
  const dragRef = useRef<{ x: number; y: number; rotX: number; rotY: number; moved: boolean } | null>(null);
  /** まだ角度に反映していない指の位置 */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  /** 最後に触った時刻。これを過ぎると自動回転を再開する */
  const lastActRef = useRef(0);
  /** 直前に回したか。回したあとの click で閉じてしまわないようにする */
  const justDraggedRef = useRef(false);

  const data = useMemo(() => buildLoadFigureData(items, completedIds), [items, completedIds]);

  /* 開いている間は、後ろの画面を描かせない（回転が軽くなる） */
  useEffect(() => {
    document.body.classList.add('load3d-open');
    return () => { document.body.classList.remove('load3d-open'); };
  }, []);

  /* 画面の広さにあわせて図の大きさを決める */
  useEffect(() => {
    const fit = () => setLayout(measureLayout());
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, []);

  /* 毎フレーム、指の位置か自動回転から角度を決めて図へ流す。
     touchmove ごとではなく1フレームに1回にまとめるので、指を速く動かしても詰まらない */
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const drag = dragRef.current;
      const pointer = pointerRef.current;
      if (drag && pointer) {
        angleRef.current = {
          y: drag.rotY + (pointer.x - drag.x) * SWIPE_DEG_PER_PX,
          x: Math.max(ROT_X_MIN, Math.min(ROT_X_MAX, drag.rotX + (pointer.y - drag.y) * TILT_DEG_PER_PX)),
        };
      } else if (now - lastActRef.current > AUTO_SPIN_DELAY_MS) {
        angleRef.current = { x: angleRef.current.x, y: angleRef.current.y + AUTO_SPIN_DPS * dt };
      }
      truckRef.current?.setAngles(angleRef.current.x, angleRef.current.y);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const start = useCallback((x: number, y: number) => {
    dragRef.current = { x, y, rotX: angleRef.current.x, rotY: angleRef.current.y, moved: false };
    pointerRef.current = { x, y };
    lastActRef.current = performance.now();
  }, []);

  const move = useCallback((x: number, y: number) => {
    const d = dragRef.current;
    if (!d) return;
    if (Math.abs(x - d.x) > 3 || Math.abs(y - d.y) > 3) d.moved = true;
    pointerRef.current = { x, y };
    lastActRef.current = performance.now();
  }, []);

  const end = useCallback(() => {
    const moved = !!dragRef.current?.moved;
    dragRef.current = null;
    pointerRef.current = null;
    lastActRef.current = performance.now();
    justDraggedRef.current = moved;
    if (moved) setTimeout(() => { justDraggedRef.current = false; }, 260);
    return moved;
  }, []);

  const { summary, stats, segments } = data;

  // body 直下に出す。こうすると、開いている間だけ後ろの画面を丸ごと隠せる
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="load3d-layer"
      onClick={() => { if (!dragRef.current && !justDraggedRef.current) onClose(); }}
      onTouchStart={(e) => { e.stopPropagation(); start(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchMove={(e) => { e.stopPropagation(); e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchEnd={(e) => { e.stopPropagation(); if (!end()) onClose(); }}
      onMouseDown={(e) => start(e.clientX, e.clientY)}
      onMouseMove={(e) => { if (e.buttons) move(e.clientX, e.clientY); }}
      onMouseUp={() => { end(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#05070c',
        cursor: 'grab', touchAction: 'none', overflow: 'hidden',
        animation: 'fadeIn 0.25s ease both',
      }}
    >
      <div style={{ width: layout.figW, flexShrink: 0, pointerEvents: 'none' }}>
        <ContainerTruck3D
          containerType={summary.containerType}
          segments={segments}
          width={layout.figW}
          aspect={layout.aspect}
          rotateX={ROT_X0}
          rotateY={ROT_Y0}
          controllerRef={truckRef}
          intro
        />
      </div>

      {/* 見出しと積載率（画面の上） */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '22px 14px 20px', pointerEvents: 'none', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.86) 55%, rgba(0,0,0,0))',
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
          {summary.spec.name} 積載状況
          {containerNo && (
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600,
              fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.45)',
            }}>{containerNo}</span>
          )}
        </span>
        {summary.hasCbm && <LoadStatCard summary={summary} compact />}
      </div>

      {/* 凡例と操作の案内（画面の下） */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '18px 12px 12px', pointerEvents: 'none', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.86) 55%, rgba(0,0,0,0))',
      }}>
        <LoadLegend stats={stats} summary={summary} compact />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
          スワイプで回転（上下で見下ろす角度）／タップで閉じる
        </span>
      </div>
    </div>,
    document.body,
  );
}

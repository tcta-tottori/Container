'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContainerItem } from '@/lib/types';
import { buildLoadFigureData, LoadLegend, LoadStatCard } from './ContainerLoadFigure';
import ContainerTruck3D from './ContainerTruck3D';

/**
 * コンテナ積載状況の全画面表示。
 * パレット図の全画面と同じで、スワイプで回転、図の外をタップで閉じる。
 * 上下のスワイプで見下ろす角度も変えられる。
 *
 * コンテナは 12m と細長いので、縦持ちのときは図だけ 90 度ねかせて
 * 画面の長いほうを使いきる。数字と凡例は読めるように立てたままにする。
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
  /** 縦持ちなので図をねかせる */
  sideways: boolean;
}

function measureLayout(): Layout {
  if (typeof window === 'undefined') return { figW: 320, aspect: 0.5, sideways: false };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sideways = vh > vw * 1.1;
  // 上下に重ねる見出し・凡例のぶんを差し引く
  const CHROME = 176;
  // ねかせるときは、図の横幅が画面の高さ、図の高さが画面の幅にあたる
  const along = sideways ? vh : vw;
  const across = sideways ? vw : vh;
  const figW = Math.max(240, along - CHROME);
  const aspect = Math.min(0.9, Math.max(0.3, (across * 0.97) / figW));
  return { figW, aspect, sideways };
}

export default function ContainerLoadFullscreen({ items, completedIds, containerNo, onClose }: Props) {
  const [rotY, setRotY] = useState(ROT_Y0);
  const [rotX, setRotX] = useState(ROT_X0);
  const [layout, setLayout] = useState<Layout>({ figW: 320, aspect: 0.5, sideways: false });
  const dragRef = useRef<{ x: number; y: number; rotY: number; rotX: number; moved: boolean } | null>(null);
  const lastActRef = useRef(0);
  /** 実際の角度。描き直しを減らすため、状態には 1 度きざみで渡す */
  const spinRef = useRef(ROT_Y0);
  /** 直前に回したかどうか。回したあとの click で閉じてしまわないようにする */
  const justDraggedRef = useRef(false);

  const data = useMemo(() => buildLoadFigureData(items, completedIds), [items, completedIds]);

  /* 画面の広さにあわせて図の大きさと向きを決める */
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

  /* 触っていない間はゆっくり回す */
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      if (!dragRef.current && now - lastActRef.current > AUTO_SPIN_DELAY_MS) {
        spinRef.current += AUTO_SPIN_DPS * dt;
        // 同じ値なら React は描き直さないので、1 度動くまで待つのと同じになる
        setRotY(Math.round(spinRef.current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const start = useCallback((x: number, y: number) => {
    spinRef.current = rotY;
    dragRef.current = { x, y, rotY, rotX, moved: false };
    lastActRef.current = performance.now();
  }, [rotY, rotX]);

  const move = useCallback((x: number, y: number) => {
    const d = dragRef.current;
    if (!d) return;
    const sx = x - d.x;
    const sy = y - d.y;
    if (Math.abs(sx) > 3 || Math.abs(sy) > 3) d.moved = true;
    // ねかせているときは、画面の縦スワイプが図の横スワイプにあたる
    const dx = layout.sideways ? sy : sx;
    const dy = layout.sideways ? -sx : sy;
    spinRef.current = d.rotY + dx * 0.45;
    setRotY(Math.round(spinRef.current));
    setRotX(Math.round(Math.max(ROT_X_MIN, Math.min(ROT_X_MAX, d.rotX + dy * 0.3))));
    lastActRef.current = performance.now();
  }, [layout.sideways]);

  const end = useCallback(() => {
    const moved = !!dragRef.current?.moved;
    dragRef.current = null;
    lastActRef.current = performance.now();
    justDraggedRef.current = moved;
    if (moved) setTimeout(() => { justDraggedRef.current = false; }, 260);
    return moved;
  }, []);

  const { summary, stats, segments } = data;

  return (
    <div
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
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)',
        cursor: 'grab', touchAction: 'none', overflow: 'hidden',
        animation: 'fadeIn 0.3s ease both',
      }}
    >
      {/* トラックの図。縦持ちのときは 90 度ねかせて画面の長いほうを使う */}
      <div style={{
        width: layout.figW, flexShrink: 0, pointerEvents: 'none',
        transform: layout.sideways ? 'rotate(90deg)' : undefined,
        animation: 'fadeIn 0.35s ease both',
      }}>
        <ContainerTruck3D
          containerType={summary.containerType}
          segments={segments}
          width={layout.figW}
          aspect={layout.aspect}
          rotateX={rotX}
          rotateY={rotY}
          intro
        />
      </div>

      {/* 見出しと積載率（立てたまま画面の上に置く） */}
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
          スワイプで回転（{layout.sideways ? '左右' : '上下'}で見下ろす角度）／タップで閉じる
        </span>
      </div>
    </div>
  );
}

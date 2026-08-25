'use client';

import React from 'react';
import { ContainerItem, ItemType } from '@/lib/types';
import { COLOR_MAP } from '@/data/colorMap';
import { itemCbm, summarizeLoad, LoadSummary } from '@/lib/containerLoad';
import ContainerTruck3D, { TruckSegment } from './ContainerTruck3D';

/**
 * コンテナの積載状況を立体のトラック図で見せるひとまとまり。
 * 分析ページの「種類分布」と、作業ページの全画面表示の両方で使う。
 */

const TYPE_ORDER: ItemType[] = ['ポリカバー', 'ジャーポット', '箱', '部品', '鍋', 'ヤーマン部品', 'その他'];

export interface TypeStat {
  type: ItemType;
  color: string;
  /** 品目数 */
  total: number;
  /** 終わった品目数 */
  done: number;
  /** 体積(m³) */
  cbm: number;
  /** 終わったぶんの体積(m³) */
  doneCbm: number;
}

export interface LoadFigureData {
  summary: LoadSummary;
  stats: TypeStat[];
  segments: TruckSegment[];
}

/** 種類ごとの内訳と、立体図に渡すセグメントを作る */
export function buildLoadFigureData(items: ContainerItem[], completedIds: Set<string>): LoadFigureData {
  const summary = summarizeLoad(items, completedIds);

  const map = new Map<ItemType, TypeStat>();
  for (const t of TYPE_ORDER) {
    map.set(t, { type: t, color: COLOR_MAP[t].accent, total: 0, done: 0, cbm: 0, doneCbm: 0 });
  }
  for (const it of items) {
    const key: ItemType = map.has(it.type) ? it.type : 'その他';
    const s = map.get(key)!;
    const cbm = itemCbm(it);
    s.total++;
    s.cbm += cbm;
    if (completedIds.has(it.id)) { s.done++; s.doneCbm += cbm; }
  }
  const stats = TYPE_ORDER.map((t) => map.get(t)!).filter((s) => s.total > 0);

  // 体積が分かっていれば体積で、分からなければ品目数で長さを割り振る
  const capacity = summary.spec.cbm;
  const totalCount = items.length || 1;
  const segments: TruckSegment[] = stats.map((s) => ({
    key: s.type,
    color: s.color,
    ratio: summary.hasCbm
      ? (capacity > 0 ? s.cbm / capacity : 0)
      : (s.total / totalCount),
    doneRatio: summary.hasCbm
      ? (s.cbm > 0 ? s.doneCbm / s.cbm : (s.total > 0 ? s.done / s.total : 0))
      : (s.total > 0 ? s.done / s.total : 0),
  })).filter((s) => s.ratio > 0);

  return { summary, stats, segments };
}

/* ===== 積載率カード ===== */
export function LoadStatCard({ summary, compact }: { summary: LoadSummary; compact: boolean }) {
  const pct = summary.loadRatio * 100;
  const over = pct > 100;
  const restPct = Math.max(0, 100 - pct);
  const restCbm = Math.max(0, summary.spec.cbm - summary.totalCbm);
  const bigSize = compact ? 26 : 40;
  const labelSize = compact ? 9 : 12;

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column',
      background: 'rgba(16,18,24,0.72)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: compact ? 10 : 14,
      padding: compact ? '8px 12px' : '12px 18px',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: compact ? 14 : 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: labelSize, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>積載率</span>
          <span style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{
              fontSize: bigSize, fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1.05,
              color: over ? '#ef4444' : '#22c55e',
              textShadow: `0 0 18px ${over ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)'}`,
            }}>{pct.toFixed(0)}</span>
            <span style={{ fontSize: bigSize * 0.45, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>%</span>
          </span>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: labelSize, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>残り容量</span>
          <span style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{
              fontSize: bigSize, fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1.05,
              color: '#fff',
            }}>{restPct.toFixed(0)}</span>
            <span style={{ fontSize: bigSize * 0.45, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>%</span>
          </span>
        </div>
      </div>
      <div style={{
        marginTop: compact ? 5 : 8, fontSize: compact ? 9 : 11,
        color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
      }}>
        積載量：約{summary.totalCbm.toFixed(1)}m³／内容積：約{summary.spec.cbm.toFixed(1)}m³
        {restCbm > 0 && `（残 約${restCbm.toFixed(1)}m³）`}
      </div>
    </div>
  );
}

/* ===== 凡例 ===== */
export function LoadLegend({ stats, summary, compact = false }: {
  stats: TypeStat[]; summary: LoadSummary; compact?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: compact ? '4px 12px' : '6px 16px',
      justifyContent: 'center',
    }}>
      {stats.map((s) => (
        <span key={s.type} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: compact ? 9 : 12, height: compact ? 9 : 12, borderRadius: 2,
            background: s.color, flexShrink: 0,
          }} />
          <span style={{ fontSize: compact ? 10 : 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
            {s.type}
            {summary.hasCbm && s.cbm > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.42)', marginLeft: 4 }}>約{s.cbm.toFixed(1)}m³</span>
            )}
          </span>
        </span>
      ))}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: compact ? 9 : 12, height: compact ? 9 : 12, borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', flexShrink: 0,
        }} />
        <span style={{ fontSize: compact ? 10 : 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
          残り容量
          {summary.hasCbm && (
            <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>
              約{Math.max(0, summary.spec.cbm - summary.totalCbm).toFixed(1)}m³
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

interface ContainerLoadFigureProps {
  items: ContainerItem[];
  completedIds: Set<string>;
  /** 図の横幅(px)。省略すると親の幅にあわせる */
  width?: number;
  rotateX?: number;
  rotateY?: number;
  /** 小さく詰めて出す（分析ページのカードの中） */
  compact?: boolean;
  /** 見出しを出す */
  showTitle?: boolean;
  /** 積載率カードを出す */
  showStats?: boolean;
  /** 凡例（種類の色）を図の下に出す */
  showLegend?: boolean;
  /** 図の高さ。横幅に対する比 */
  aspect?: number;
  /** 出てくるときのアニメーション */
  intro?: boolean;
  /** 事前に計算した内訳（親で使い回すとき） */
  data?: LoadFigureData;
}

export default function ContainerLoadFigure({
  items, completedIds, width, rotateX, rotateY, aspect,
  compact = false, showTitle = true, showStats = true, showLegend = true,
  intro = false, data,
}: ContainerLoadFigureProps) {
  const { summary, stats, segments } = data || buildLoadFigureData(items, completedIds);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {showTitle && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 6 : 10, flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: compact ? 13 : 17, fontWeight: 800, color: '#fff',
          }}>
            {summary.spec.name} 積載状況
          </span>
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 4,
            background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 700,
          }}>推定</span>
        </div>
      )}

      {/* 積載率カード。回すと図が動くので、重ねずに図の上に並べる */}
      {showStats && summary.hasCbm && (
        <div style={{ marginBottom: compact ? 4 : 8 }}>
          <LoadStatCard summary={summary} compact={compact} />
        </div>
      )}

      <div style={{ position: 'relative' }}>

        <ContainerTruck3D
          containerType={summary.containerType}
          segments={segments}
          width={width}
          aspect={aspect}
          rotateX={rotateX}
          rotateY={rotateY}
          intro={intro}
        />
      </div>

      {/* 凡例 */}
      {showLegend && (
        <div style={{ marginTop: compact ? 2 : 6 }}>
          <LoadLegend stats={stats} summary={summary} compact={compact} />
        </div>
      )}
    </div>
  );
}

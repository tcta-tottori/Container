'use client';

import { CSSProperties } from 'react';

/**
 * アプリ共通の白線アイコン。
 * カラフルな絵文字を使わず、線画（currentColor）でトーンを統一する。
 */
export interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

function Svg({ size = 24, strokeWidth = 1.8, className, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** ハンバーガーメニュー */
export function MenuIcon(p: IconProps) {
  return <Svg {...p}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></Svg>;
}

/** 天気コール（太陽 + 雲） */
export function WeatherIcon(p: IconProps) {
  return <Svg {...p}><path d="M16 13a4 4 0 1 0-5-5" /><path d="M7 18a4 4 0 0 1 .5-7.97A5 5 0 0 1 17 12.5a3.5 3.5 0 0 1-.5 6.95H7z" /></Svg>;
}

/** 応援コール（メガホン） */
export function MegaphoneIcon(p: IconProps) {
  return <Svg {...p}><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" /><path d="M16 9a3.5 3.5 0 0 1 0 6" /><path d="M18.5 6.5a7 7 0 0 1 0 11" /></Svg>;
}

/** 水の音（しずく） */
export function DropletIcon(p: IconProps) {
  return <Svg {...p}><path d="M12 3.2 6.9 9.4a6.5 6.5 0 1 0 10.2 0L12 3.2z" /><path d="M9 14.5a3 3 0 0 0 2.4 2.4" /></Svg>;
}

/** 設定（歯車） */
export function SettingsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </Svg>
  );
}

/** 履歴（時計） */
export function ClockIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></Svg>;
}

/** アップロード（読込） */
export function UploadIcon(p: IconProps) {
  return <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></Svg>;
}

/** 作業ページ */
export function WorkIcon(p: IconProps) {
  return <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /></Svg>;
}

/** 管理（編集） */
export function EditIcon(p: IconProps) {
  return <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>;
}

/** 分析 */
export function ChartIcon(p: IconProps) {
  return <Svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Svg>;
}

/** マニュアル（？） */
export function HelpIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></Svg>;
}

/** 気温（温度計） */
export function ThermometerIcon(p: IconProps) {
  return <Svg {...p}><path d="M14 14.8V4.5a2 2 0 1 0-4 0v10.3a4 4 0 1 0 4 0z" /></Svg>;
}

/** センサー（電波） */
export function SensorIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="2" /><path d="M8.5 15.5a5 5 0 0 1 0-7" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M5.8 18.2a9 9 0 0 1 0-12.4" /><path d="M18.2 5.8a9 9 0 0 1 0 12.4" /></Svg>;
}

/** 写真・カメラ（AI写真設定） */
export function CameraIcon(p: IconProps) {
  return <Svg {...p}><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h6l1.3 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="3.2" /></Svg>;
}

/** ファイル */
export function FileIcon(p: IconProps) {
  return <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="12" y2="12" /><line x1="15" y1="15" x2="12" y2="12" /></Svg>;
}

/** 閉じる */
export function CloseIcon(p: IconProps) {
  return <Svg {...p}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></Svg>;
}

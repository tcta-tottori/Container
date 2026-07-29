'use client';

import { WeatherData, wbgtLevel } from '@/lib/weatherNews';
import { SwitchBotReading } from '@/lib/switchbot';

const TEMP_COLOR = '#fb923c'; // 気温（オレンジ）
const HUM_COLOR = '#38bdf8';  // 湿度（水色）

export type SwitchBotStatus = 'unsupported' | 'idle' | 'scanning' | 'error';

interface ClimateBarProps {
  /** 気象庁（Open-Meteo）データ。未取得は null */
  weather: WeatherData | null;
  /** SwitchBot の最新値。未受信は null */
  switchbot: SwitchBotReading | null;
  /** SwitchBot 接続状態 */
  sbStatus: SwitchBotStatus;
  /** SwitchBot エラー内容 */
  sbError?: string | null;
  /** 接続ボタン押下（開始/停止トグル） */
  onToggleSwitchBot: () => void;
  /** 気象庁データ部タップ（気温・湿度・グラフの詳細を表示） */
  onOpenWeather?: () => void;
}

/** 小さな数値スタット（ラベル + 値 + 単位） */
function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
        {value}
        <span style={{ fontSize: 9, fontWeight: 600, marginLeft: 1 }}>{unit}</span>
      </span>
    </div>
  );
}

/** SwitchBot − 気象庁 の差分チップ */
function DiffChip({ diff, unit }: { diff: number; unit: string }) {
  const rounded = Math.round(diff * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  // 高いほど暖色、低いほど寒色（±0 は中立グレー）
  const color = rounded > 0 ? '#f87171' : rounded < 0 ? '#60a5fa' : 'rgba(255,255,255,0.45)';
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color,
        fontFamily: 'var(--font-mono)',
        marginTop: 1,
      }}
    >
      {sign}
      {rounded}
      {unit}
    </span>
  );
}

/**
 * ヘッダー下に表示する温湿度バー。
 * 左：気象庁（Open-Meteo）データ、右：SwitchBot データ（接続後、気象庁との差異も表示）。
 */
export default function ClimateBar({
  weather,
  switchbot,
  sbStatus,
  sbError,
  onToggleSwitchBot,
  onOpenWeather,
}: ClimateBarProps) {
  const wLv = weather ? wbgtLevel(weather.wbgt) : null;
  const sbLv = switchbot ? wbgtLevel(switchbot.wbgt) : null;

  return (
    <div className="climate-bar">
      {/* ===== 気象庁（Open-Meteo）===== タップで気温・湿度・グラフの詳細 ===== */}
      <div
        className={`climate-seg${weather && onOpenWeather ? ' climate-seg-tap' : ''}`}
        onClick={weather && onOpenWeather ? onOpenWeather : undefined}
        role={weather && onOpenWeather ? 'button' : undefined}
        title={weather && onOpenWeather ? 'タップで気温・湿度・推移グラフを表示' : undefined}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
          <span className="climate-seg-label" style={{ color: 'rgba(255,255,255,0.55)' }}>
            🏢 気象庁
          </span>
          {weather?.time ? (
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              {weather.time} 時点
            </span>
          ) : null}
        </div>
        {weather ? (
          <>
            <Stat label="気温" value={`${weather.temperature}`} unit="°C" color={TEMP_COLOR} />
            <Stat label="湿度" value={`${weather.humidity}`} unit="%" color={HUM_COLOR} />
            <Stat
              label="暑さ指数"
              value={`${weather.wbgt}`}
              unit=""
              color={wLv?.color || '#c084fc'}
            />
            {onOpenWeather && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>取得中…</span>
        )}
      </div>

      <div className="climate-divider" />

      {/* ===== SwitchBot ===== */}
      <div className="climate-seg">
        <span className="climate-seg-label" style={{ color: '#4ade80' }}>
          📡 SwitchBot
        </span>

        {switchbot ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Stat label="気温" value={`${switchbot.temperature}`} unit="°C" color={TEMP_COLOR} />
              {weather && <DiffChip diff={switchbot.temperature - weather.temperature} unit="°" />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Stat label="湿度" value={`${switchbot.humidity}`} unit="%" color={HUM_COLOR} />
              {weather && <DiffChip diff={switchbot.humidity - weather.humidity} unit="%" />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Stat
                label="暑さ指数"
                value={`${switchbot.wbgt}`}
                unit=""
                color={sbLv?.color || '#c084fc'}
              />
              {weather && <DiffChip diff={switchbot.wbgt - weather.wbgt} unit="" />}
            </div>
            {/* 電池 + 停止ボタン */}
            <button
              onClick={onToggleSwitchBot}
              className="climate-btn"
              title="SwitchBot スキャンを停止"
              style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.4)' }}
            >
              {switchbot.battery != null ? `🔋${switchbot.battery}%` : '停止'}
            </button>
          </>
        ) : sbStatus === 'scanning' ? (
          <>
            <span className="climate-scan-dot" />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>受信待ち…</span>
            <button onClick={onToggleSwitchBot} className="climate-btn" title="停止">
              停止
            </button>
          </>
        ) : sbStatus === 'unsupported' ? (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }} title="Chrome の実験的機能（Web Bluetooth スキャン）が必要です">
            非対応
          </span>
        ) : (
          <>
            <button
              onClick={onToggleSwitchBot}
              className="climate-btn"
              style={{ color: '#4ade80', borderColor: 'rgba(74,222,128,0.4)' }}
            >
              接続
            </button>
            {sbStatus === 'error' && sbError && (
              <span
                style={{ fontSize: 9, color: '#f87171', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={sbError}
              >
                {sbError}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

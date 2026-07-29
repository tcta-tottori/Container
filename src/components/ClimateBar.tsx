'use client';

import { useState } from 'react';
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

  const [infoOpen, setInfoOpen] = useState(false);

  // SwitchBot の状態説明・対処法
  const sbInfo = (() => {
    if (switchbot) {
      const age = Math.round((Date.now() - switchbot.updatedAt) / 1000);
      return {
        title: '受信中',
        color: '#4ade80',
        lines: [
          `気温 ${switchbot.temperature}°C / 湿度 ${switchbot.humidity}% / 暑さ指数 ${switchbot.wbgt}`,
          switchbot.battery != null ? `電池 ${switchbot.battery}%` : '',
          switchbot.rssi != null ? `電波強度 ${switchbot.rssi}dBm` : '',
          switchbot.deviceName ? `デバイス ${switchbot.deviceName}` : '',
          `最終受信 ${age}秒前`,
        ].filter(Boolean),
      };
    }
    if (sbStatus === 'unsupported') {
      return {
        title: '非対応',
        color: '#f87171',
        lines: [
          'この端末・ブラウザは Bluetooth スキャンに対応していません。',
          'Android Chrome で chrome://flags/#enable-experimental-web-platform-features を「有効」にし、Chrome を再起動してください。',
        ],
      };
    }
    if (sbStatus === 'scanning') {
      return {
        title: 'スキャン中（受信待ち）',
        color: '#facc15',
        lines: [
          'SwitchBot 温湿度計の電波を待っています（数十秒かかることがあります）。',
          '温湿度計の電源が入っていて、スマホの近くにあることを確認してください。',
        ],
      };
    }
    if (sbStatus === 'error') {
      return {
        title: 'エラー',
        color: '#f87171',
        lines: [
          sbError || '不明なエラー',
          '─────────',
          '確認: ①スマホの Bluetooth がオン ②「近くのデバイスをスキャン」の許可を「許可」 ③温湿度計が近くにある',
          'もう一度「接続」を押すと再試行します。',
        ],
      };
    }
    return {
      title: '未接続',
      color: 'rgba(255,255,255,0.7)',
      lines: [
        '「接続」を押すと SwitchBot 温湿度計のスキャンを開始します。',
        '初回は Bluetooth スキャンの許可ダイアログが出るので「許可」してください。',
      ],
    };
  })();

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
        <span
          className="climate-seg-label climate-seg-tap"
          style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: 3 }}
          onClick={() => setInfoOpen((v) => !v)}
          role="button"
          title="タップで状態・対処法を表示"
        >
          📡 SwitchBot
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 13, height: 13, borderRadius: '50%',
            border: '1px solid rgba(74,222,128,0.6)', fontSize: 9, lineHeight: 1,
          }}>i</span>
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
            {sbStatus === 'error' && (
              <span style={{ fontSize: 10, color: '#f87171', flexShrink: 0 }}>エラー（詳細→ⓘ）</span>
            )}
          </>
        )}
      </div>

      {/* SwitchBot 詳細ポップアップ（状態・エラー全文・対処法） */}
      {infoOpen && (
        <>
          <div
            onClick={() => setInfoOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 240, background: 'rgba(0,0,0,0.35)' }}
          />
          <div
            style={{
              position: 'fixed', top: 96, left: 8, right: 8, zIndex: 241,
              maxWidth: 420, margin: '0 auto',
              background: 'linear-gradient(160deg, #0d1b2a 0%, #12233a 55%, #0e1830 100%)',
              border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: 16,
              padding: 14, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              animation: 'fadeIn 0.15s ease both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 700 }}>📡 SwitchBot</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: sbInfo.color,
                  padding: '2px 8px', borderRadius: 999,
                  background: `${sbInfo.color}22`, border: `1px solid ${sbInfo.color}55`,
                }}>
                  {sbInfo.title}
                </span>
              </div>
              <button
                onClick={() => setInfoOpen(false)}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: 1, flexShrink: 0,
                }}
              >×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sbInfo.lines.map((line, i) => (
                <div key={i} style={{
                  fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)',
                  wordBreak: 'break-word',
                }}>
                  {line}
                </div>
              ))}
            </div>
            {/* 接続/停止アクション */}
            <button
              onClick={() => { onToggleSwitchBot(); if (sbStatus !== 'error') setInfoOpen(false); }}
              disabled={sbStatus === 'unsupported'}
              style={{
                marginTop: 12, width: '100%', padding: '9px',
                borderRadius: 10, cursor: sbStatus === 'unsupported' ? 'not-allowed' : 'pointer',
                background: sbStatus === 'scanning' || switchbot ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.14)',
                border: `1px solid ${sbStatus === 'scanning' || switchbot ? 'rgba(239,68,68,0.4)' : 'rgba(74,222,128,0.4)'}`,
                color: sbStatus === 'scanning' || switchbot ? '#f87171' : '#4ade80',
                fontSize: 13, fontWeight: 700, opacity: sbStatus === 'unsupported' ? 0.4 : 1,
              }}
            >
              {sbStatus === 'unsupported' ? '非対応' : (sbStatus === 'scanning' || switchbot) ? 'スキャン停止' : (sbStatus === 'error' ? '再試行（接続）' : '接続')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

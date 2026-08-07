'use client';

import { useState } from 'react';
import { WeatherData, wbgtLevel } from '@/lib/weatherNews';
import { SwitchBotReading } from '@/lib/switchbot';

/** SwitchBot の「S」マーク */
function SwitchBotMark({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 5, flexShrink: 0,
        border: '1.5px solid currentColor',
        fontSize: size * 0.68, fontWeight: 900, lineHeight: 1,
        fontFamily: 'var(--font-mono)',
      }}
    >
      S
    </span>
  );
}

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
  /** SwitchBotデータ部タップ（数値・グラフ・気象庁との差を表示） */
  onOpenSwitchBot?: () => void;
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
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 21, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
        {value}
        <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 1 }}>{unit}</span>
      </span>
    </div>
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
  onOpenSwitchBot,
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
          `判定機種: ${switchbot.model === 'outdoor' ? '防水/屋外モデル' : '室内モデル'}`,
          switchbot.battery != null ? `電池 ${switchbot.battery}%` : '',
          switchbot.rssi != null ? `電波強度 ${switchbot.rssi}dBm` : '',
          switchbot.deviceName ? `デバイス ${switchbot.deviceName}` : '',
          `最終受信 ${age}秒前`,
          `生データ: ${switchbot.raw}`,
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
      {switchbot ? (
        /* ===== SwitchBot 有効時: SwitchBot のみ表示（タップで詳細ポップアップ） ===== */
        <div
          className="climate-seg climate-seg-tap"
          onClick={onOpenSwitchBot}
          role="button"
          title="タップで数値・グラフ・気象庁との差を表示"
          style={{ flex: 1, minWidth: 0 }}
        >
          <span className="climate-seg-label" style={{ color: '#4ade80' }}>
            <SwitchBotMark size={20} />
          </span>
          <Stat label="気温" value={`${switchbot.temperature}`} unit="°C" color={TEMP_COLOR} />
          <Stat label="湿度" value={`${switchbot.humidity}`} unit="%" color={HUM_COLOR} />
          <Stat label="暑さ指数" value={`${switchbot.wbgt}`} unit="" color={sbLv?.color || '#c084fc'} />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <div style={{ flex: 1 }} />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSwitchBot(); }}
            className="climate-btn"
            title="SwitchBot スキャンを停止"
            style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}
          >
            停止
          </button>
        </div>
      ) : (
        <>
          {/* ===== 気象庁（Open-Meteo）===== タップで気温・湿度・グラフの詳細 ===== */}
          <div
            className={`climate-seg${weather && onOpenWeather ? ' climate-seg-tap' : ''}`}
            onClick={weather && onOpenWeather ? onOpenWeather : undefined}
            role={weather && onOpenWeather ? 'button' : undefined}
            title={weather && onOpenWeather ? 'タップで気温・湿度・推移グラフを表示' : undefined}
          >
            {/* 出典（気象庁）と観測時刻はポップアップ側に表示する */}
            {weather ? (
              <>
                <Stat label="気温" value={`${weather.temperature}`} unit="°C" color={TEMP_COLOR} />
                <Stat label="湿度" value={`${weather.humidity}`} unit="%" color={HUM_COLOR} />
                <Stat label="暑さ指数" value={`${weather.wbgt}`} unit="" color={wLv?.color || '#c084fc'} />
                {onOpenWeather && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </>
            ) : (
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>取得中…</span>
            )}
          </div>

          <div className="climate-divider" />

          {/* ===== SwitchBot（未接続/スキャン/エラー）: Sマーク +「接続」ボタンのみ ===== */}
          <div className="climate-seg">
            {sbStatus === 'scanning' ? (
              <>
                <span className="climate-scan-dot" />
                <button
                  onClick={onToggleSwitchBot}
                  className="climate-btn"
                  title="SwitchBot スキャンを停止"
                  style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.4)', gap: 7 }}
                >
                  <SwitchBotMark />
                  停止
                </button>
              </>
            ) : sbStatus === 'unsupported' ? (
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} title="Chrome の実験的機能（Web Bluetooth スキャン）が必要です">
                非対応
              </span>
            ) : (
              <>
                <button
                  onClick={onToggleSwitchBot}
                  onContextMenu={(e) => { e.preventDefault(); setInfoOpen(true); }}
                  className="climate-btn"
                  title="SwitchBot 温湿度計に接続（長押しで状態・対処法）"
                  style={{
                    color: sbStatus === 'error' ? '#f87171' : '#4ade80',
                    borderColor: sbStatus === 'error' ? 'rgba(248,113,113,0.4)' : 'rgba(74,222,128,0.4)',
                    gap: 7,
                  }}
                >
                  <SwitchBotMark />
                  接続
                </button>
                {sbStatus === 'error' && (
                  <span
                    className="climate-seg-tap"
                    onClick={() => setInfoOpen(true)}
                    role="button"
                    style={{ fontSize: 15, color: '#f87171', flexShrink: 0 }}
                  >
                    エラー
                  </span>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* SwitchBot 詳細ポップアップ（状態・エラー全文・対処法） */}
      {infoOpen && (
        <>
          <div
            onClick={() => setInfoOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 240, background: 'rgba(0,0,0,0.35)' }}
          />
          <div
            style={{
              position: 'fixed', top: 'calc(96px + var(--safe-top))', left: 8, right: 8, zIndex: 241,
              maxWidth: 420, margin: '0 auto',
              background: 'linear-gradient(160deg, #0d1b2a 0%, #12233a 55%, #0e1830 100%)',
              border: '1.5px solid rgba(255,255,255,0.14)', borderRadius: 16,
              padding: 14, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              animation: 'fadeIn 0.15s ease both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <SwitchBotMark size={16} />
                  SwitchBot
                </span>
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
              {sbInfo.lines.map((line, i) => {
                const isRaw = line.startsWith('生データ:');
                return (
                  <div key={i} style={{
                    fontSize: isRaw ? 9 : 11, lineHeight: 1.5,
                    color: isRaw ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.8)',
                    fontFamily: isRaw ? 'var(--font-mono, monospace)' : undefined,
                    wordBreak: 'break-all',
                  }}>
                    {line}
                  </div>
                );
              })}
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

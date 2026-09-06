'use client';

import { useEffect, useState } from 'react';
import { Container } from '@/lib/types';
import { SwitchBotReading, SwitchBotStatus } from '@/lib/switchbot';
import { MegaphoneIcon, WeatherIcon, DropletIcon, CloseIcon, SettingsIcon, RiverIcon, HandIcon } from '@/components/AppIcons';

interface QuickActionsProps {
  /** コンテナ選択（読込済みのときだけ表示） */
  containers: Container[];
  selectedIdx: number;
  onSelectContainer: (idx: number) => void;
  /** 応援コール・天気コール（作業ページでのみ有効） */
  onCheer?: () => void;
  onWeather?: () => void;
  /** 「お願いします！」のコール（作業ページでのみ有効） */
  onRequestCall?: () => void;
  /** 「長谷川さん！お願いします！」のコール（作業ページでのみ有効） */
  onNameCall?: () => void;
  /** 水の音 */
  waterPlaying: boolean;
  onWater: () => void;
  onWaterSettings: () => void;
  /** SwitchBot */
  switchbot: SwitchBotReading | null;
  sbStatus: SwitchBotStatus;
  sbError?: string | null;
  onToggleSwitchBot: () => void;
  onOpenSwitchBot: () => void;
  /** せせらぎモード（川の映像）を開く */
  onOpenRiver: () => void;
  /** 左メニューなど別の画面が開いている間は隠す */
  hidden?: boolean;
}

/** メニューを開くボタンのアイコン（上向きの山だけ）。開くと180度回って下向きになる */
export function QuickMenuIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
      aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline points="5 15.5 12 8.5 19 15.5" />
    </svg>
  );
}

/** SwitchBot の「S」マーク */
function SwitchBotMark({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        border: '1.5px solid currentColor',
        fontSize: size * 0.66, fontWeight: 900, lineHeight: 1,
      }}
    >
      S
    </span>
  );
}

/** メニュー内の1行 */
function Row({
  icon, title, sub, accent, onClick, trailing,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  accent?: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
      <button
        onClick={onClick}
        className="quick-row"
        style={{ color: accent || 'rgba(255,255,255,0.85)' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26 }}>
          {icon}
        </span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</span>
          {sub && <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{sub}</span>}
        </span>
      </button>
      {trailing}
    </div>
  );
}

/**
 * 画面右下の展開メニュー。
 * ヘッダーから外したボタン（コンテナ選択・応援コール・天気コール・水の音・SwitchBot接続）をここに集約する。
 */
export default function QuickActions({
  containers, selectedIdx, onSelectContainer,
  onCheer, onWeather, onRequestCall, onNameCall,
  waterPlaying, onWater, onWaterSettings,
  switchbot, sbStatus, sbError, onToggleSwitchBot, onOpenSwitchBot, onOpenRiver, hidden,
}: QuickActionsProps) {
  const [open, setOpen] = useState(false);
  const [sbInfoOpen, setSbInfoOpen] = useState(false);

  // 別の画面が開いたら閉じる
  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const sbLabel = switchbot ? '受信中'
    : sbStatus === 'scanning' ? '受信待ち…'
    : sbStatus === 'unsupported' ? '非対応'
    : sbStatus === 'error' ? 'エラー'
    : '未接続';
  const sbAccent = switchbot ? '#4ade80'
    : sbStatus === 'error' || sbStatus === 'unsupported' ? '#f87171'
    : sbStatus === 'scanning' ? '#facc15'
    : 'rgba(255,255,255,0.85)';

  if (hidden) return null;

  return (
    <>
      {/* 展開ボタン（右下） */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`quick-fab${waterPlaying ? ' quick-fab-water-on' : ''}`}
        aria-label="メニューを開く"
        title="メニュー"
      >
        <span className={`quick-fab-icon${open ? ' open' : ''}`}>
          <QuickMenuIcon size={24} />
        </span>
      </button>

      {open && (
        <div className="quick-overlay" onClick={() => setOpen(false)}>
          <div className="quick-sheet" onClick={(e) => e.stopPropagation()}>
            {/* コンテナ選択 */}
            {containers.length > 0 && (
              <>
                <div className="quick-heading">コンテナ</div>
                <div className="quick-container-list">
                  {containers.map((c, i) => {
                    const hasDateSuffix = /\(\d{1,2}\/\d{1,2}\)\s*$/.test(c.containerNo);
                    const label = hasDateSuffix
                      ? c.containerNo
                      : `${c.containerNo} (${c.date.slice(5).replace('-', '/')})`;
                    const active = i === selectedIdx;
                    return (
                      <button
                        key={c.containerNo}
                        onClick={() => { onSelectContainer(i); setOpen(false); }}
                        className={`quick-container${active ? ' active' : ''}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="quick-heading">操作</div>

            {onCheer && (
              <Row
                icon={<MegaphoneIcon size={22} />}
                title="応援コール"
                sub="登録したフレーズをランダムで読み上げ"
                onClick={() => { onCheer(); setOpen(false); }}
              />
            )}

            {onRequestCall && (
              <Row
                icon={<HandIcon size={22} />}
                title="お願いします！"
                sub="合図のコール"
                onClick={() => { onRequestCall(); setOpen(false); }}
              />
            )}

            {onNameCall && (
              <Row
                icon={<HandIcon size={22} />}
                title="長谷川さん！お願いします！"
                sub="名前を呼ぶ合図のコール"
                onClick={() => { onNameCall(); setOpen(false); }}
              />
            )}

            {onWeather && (
              <Row
                icon={<WeatherIcon size={22} />}
                title="天気コール"
                sub="気温・湿度・暑さ指数と今日の予報"
                onClick={() => { onWeather(); setOpen(false); }}
              />
            )}

            <Row
              icon={<DropletIcon size={22} />}
              title={waterPlaying ? '水の音を止める' : '水の音を流す'}
              sub={waterPlaying ? '再生中（フェードアウトで停止）' : '作業用BGM'}
              accent={waterPlaying ? '#67e8f9' : undefined}
              onClick={() => { onWater(); setOpen(false); }}
              trailing={
                <button
                  onClick={() => { onWaterSettings(); setOpen(false); }}
                  className="quick-side-btn"
                  aria-label="水の音の設定"
                  title="水の音の設定"
                >
                  <SettingsIcon size={18} />
                </button>
              }
            />

            <Row
              icon={<RiverIcon size={22} />}
              title="せせらぎモード"
              sub="川の映像に品目情報が流れます"
              onClick={() => { onOpenRiver(); setOpen(false); }}
            />

            <Row
              icon={<SwitchBotMark size={22} />}
              title={switchbot || sbStatus === 'scanning' ? 'SwitchBot を停止' : 'SwitchBot に接続'}
              sub={`温湿度計・${sbLabel}`}
              accent={sbAccent}
              onClick={() => {
                if (sbStatus === 'unsupported') { setSbInfoOpen(true); return; }
                onToggleSwitchBot();
                setOpen(false);
              }}
              trailing={
                <button
                  onClick={() => {
                    if (switchbot) { onOpenSwitchBot(); setOpen(false); }
                    else setSbInfoOpen(true);
                  }}
                  className="quick-side-btn"
                  aria-label="SwitchBot の状態"
                  title="SwitchBot の状態・対処法"
                >
                  <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>i</span>
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* SwitchBot の状態・対処法 */}
      {sbInfoOpen && (
        <div className="quick-overlay quick-overlay-center" onClick={() => setSbInfoOpen(false)}>
          <div className="quick-info" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <span style={{ color: sbAccent, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700 }}>
                <SwitchBotMark size={18} />
                SwitchBot
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: sbAccent,
                padding: '3px 10px', borderRadius: 999,
                background: `${sbAccent}22`, border: `1px solid ${sbAccent}55`,
              }}>
                {sbLabel}
              </span>
              <button
                onClick={() => setSbInfoOpen(false)}
                className="quick-side-btn"
                style={{ marginLeft: 'auto' }}
                aria-label="閉じる"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)' }}>
              {sbStatus === 'unsupported' ? (
                <>
                  <div>この端末・ブラウザは Bluetooth スキャンに対応していません。</div>
                  <div>Android Chrome で chrome://flags/#enable-experimental-web-platform-features を「有効」にし、Chrome を再起動してください。</div>
                </>
              ) : sbStatus === 'error' ? (
                <>
                  <div style={{ color: '#fca5a5', wordBreak: 'break-all' }}>{sbError || '不明なエラー'}</div>
                  <div>確認: ①スマホの Bluetooth がオン ②「近くのデバイスをスキャン」の許可 ③温湿度計が近くにある</div>
                </>
              ) : sbStatus === 'scanning' ? (
                <>
                  <div>温湿度計の電波を待っています（数十秒かかることがあります）。</div>
                  <div>電源が入っていて、スマホの近くにあることを確認してください。</div>
                </>
              ) : (
                <>
                  <div>「接続」で SwitchBot 温湿度計のスキャンを開始します。</div>
                  <div>初回は Bluetooth スキャンの許可ダイアログが出るので「許可」してください。</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

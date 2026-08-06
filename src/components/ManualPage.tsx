'use client';

import { useState } from 'react';

interface ManualPageProps {
  onClose: () => void;
}

/* ===== ステップカード ===== */
function Step({ num, title, desc, icon }: { num: number; title: string; desc: string; icon: string }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 16, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.25))',
        border: '1px solid rgba(59,130,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 800, color: '#60a5fa', fontFamily: 'var(--font-mono)',
      }}>{num}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>{title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ===== セクション ===== */
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 16, fontWeight: 800, color, marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 8, borderBottom: `2px solid ${color}40`,
      }}>
        <span style={{ width: 4, height: 18, borderRadius: 2, background: color }} />
        {title}
      </div>
      {children}
    </div>
  );
}

/* ===== 情報カード ===== */
function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 16,
      border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

/* ===== 音声コマンド表 ===== */
function VoiceTable() {
  const cmds = [
    { word: 'OK / OKです / お願いします', action: 'パレット1つ減らす（0で完了）', color: '#ef4444' },
    { word: '次 / つぎ', action: '次の品目へ移動', color: '#60a5fa' },
    { word: '前 / まえ', action: '前の品目へ移動', color: '#60a5fa' },
    { word: '読み上げ', action: '現在の品目をアナウンス', color: '#22c55e' },
    { word: '概要 / コンテナ', action: 'コンテナ概要をアナウンス', color: '#f59e0b' },
    { word: '戻して / 元に戻して', action: 'パレットを1つ戻す', color: '#8b5cf6' },
    { word: 'あと何種類？', action: '残り種類数をコール', color: '#22c55e' },
    { word: 'パレット何枚？', action: 'パレット数を読み上げ', color: '#60a5fa' },
    { word: '端数', action: '端数ケース数を読み上げ', color: '#60a5fa' },
  ];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
    }}>
      {cmds.map((c, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', padding: '10px 14px',
          borderBottom: i < cmds.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: c.color,
            minWidth: 160, fontFamily: 'var(--font-mono)',
          }}>「{c.word}」</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{c.action}</span>
        </div>
      ))}
    </div>
  );
}

/* ===== メインコンポーネント ===== */
export default function ManualPage({ onClose }: ManualPageProps) {
  const [tab, setTab] = useState<'basic' | 'voice' | 'data' | 'nabe'>('basic');

  const tabs = [
    { id: 'basic' as const, label: '基本操作', icon: '📋' },
    { id: 'voice' as const, label: '音声', icon: '🎤' },
    { id: 'data' as const, label: 'データ', icon: '📁' },
    { id: 'nabe' as const, label: '鍋ルール', icon: '🍲' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'linear-gradient(180deg, #0d0f18 0%, #13151f 100%)',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* ヘッダー */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        background: 'rgba(26,29,46,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button onClick={onClose} style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
        <div>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>操作マニュアル</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>CNS v2.2</span>
        </div>
      </div>

      {/* タブ */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 16px',
        background: 'rgba(19,21,31,0.8)', borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', border: 'none', transition: 'all 0.2s',
              background: tab === t.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: tab === t.id ? '#60a5fa' : 'rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div style={{ padding: '20px 16px 80px' }}>

        {/* ===== 基本操作 ===== */}
        {tab === 'basic' && (
          <>
            <Section title="作業の流れ" color="#60a5fa">
              <Step num={1} title="ファイルを読み込む" icon="📁"
                desc="読込画面でExcelファイルをドラッグ＆ドロップ、Googleドライブから選択、またはGitHubリポジトリから読込。コンテナ日程・AQSS04L両方に対応。" />
              <Step num={2} title="概要アナウンスを確認" icon="🔊"
                desc="読込完了後、コンテナの概要（種類別品目数・類似品の有無）が自動でアナウンスされます。鍋コンテナは100/180サイズ別に読み上げ。" />
              <Step num={3} title="音声で「OK」と言う" icon="🗣️"
                desc="パレットが1つ減ります。残りパレット数と端数がコールされます。パレット0・端数0で自動完了→次の品目へ。" />
              <Step num={4} title="全品目完了" icon="✅"
                desc="全品目の荷降ろしが完了すると「全品目完了」がコールされます。" />
            </Section>

            <Section title="マイクボタン" color="#8b5cf6">
              <InfoCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { color: '#4a6ef7', label: '青', desc: '待機中（タップで録音開始）' },
                    { color: '#dc2626', label: '赤', desc: '録音中（音声コマンド受付中）' },
                    { color: '#8b5cf6', label: '紫', desc: '音声コール中（波形アニメーション）' },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                        background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 12, color: '#fff' }}>🎤</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>{m.desc}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.6 }}>
                    ※ 紫（コール中）にタップするとコールを強制終了できます
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="スワイプ操作" color="#f59e0b">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    リストの品目行を<strong style={{ color: '#4ade80' }}>右にスワイプ</strong> → 完了（緑ネオンで「✓完了」表示）
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    完了済みの行を<strong style={{ color: '#f87171' }}>左にスワイプ</strong> → 元に戻す
                  </div>
                  <div>
                    スワイプ完了時は次の品目が自動でアナウンスされます。
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="端数パレット" color="#22c55e">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#22c55e' }}>四隅ルール</strong>: 最上段は必ず四隅にハコがある状態で積みます。中央から抜いていきます。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#60a5fa' }}>タップで拡大</strong>: 端数パレット図をタップすると上半分枠内で拡大表示。スワイプで回転操作可能。
                  </div>
                  <div>
                    <strong style={{ color: '#f59e0b' }}>自動ズーム</strong>: 端数のみの品目に切り替わった時、0.5秒後に自動拡大→5秒で元に戻ります（1品名1回のみ）。
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="テーマ切替" color="#a78bfa">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  ヘッダーの<strong style={{ color: '#a78bfa' }}>☀/🌙アイコン</strong>でダークモード⇔ライトモードを切替。
                  ライトモードでは種類別の鮮やかなグラデーション背景に変わります。設定はブラウザに保存されます。
                </div>
              </InfoCard>
            </Section>
          </>
        )}

        {/* ===== 音声コマンド ===== */}
        {tab === 'voice' && (
          <>
            <Section title="音声コマンド一覧" color="#f59e0b">
              <VoiceTable />
            </Section>

            <Section title="音声認識の使い方" color="#22c55e">
              <Step num={1} title="マイクボタンをタップ" icon="🎤"
                desc="画面下部中央のマイクボタンをタップして録音開始。ボタンが赤くなり、パルスアニメーションが表示されます。" />
              <Step num={2} title="コマンドを発声" icon="🗣️"
                desc="はっきりと短いキーワードを発声。倉庫の騒音環境でも認識しやすいよう設計されています。" />
              <Step num={3} title="結果を確認" icon="💬"
                desc="コール中はマイクボタンが紫に変わり波形アニメーション表示。コール内容がテキストでも表示されます。" />
            </Section>

            <Section title="ループ防止機能" color="#ef4444">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    音声コール中は<strong style={{ color: '#ef4444' }}>録音が自動停止</strong>し、コール終了3秒後に再開します。これにより自分のコール音を拾ってループすることを防止しています。
                  </div>
                  <div>
                    OKコマンドは<strong style={{ color: '#f59e0b' }}>7秒のクールダウン</strong>があり、連続実行を防ぎます。
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="自動アナウンス" color="#60a5fa">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#60a5fa' }}>品目切替時</strong>: 品名・パレット数・ケース数を読み上げ。ポリカバーは検査分も計算。類似品がある場合は警告。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#22c55e' }}>コンテナ読み込み時</strong>: 種類別品目数、類似品の有無をアナウンス。鍋は100/180サイズ別にコール。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#ef4444' }}>OKコマンド後</strong>: 「残り○パレットと○ケース。」のみコール（次の品目コールはなし）。
                  </div>
                  <div>
                    <strong style={{ color: '#f59e0b' }}>10分ごとのコール</strong>: 経過時間＋気温・湿度・暑さ指数と警戒レベル（危険／厳重警戒／警戒／注意）をコール。SwitchBot 接続中は実測値を使います。
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="作業用BGM（水の音）" color="#22d3ee">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    ヘッダーの<strong style={{ color: '#67e8f9' }}>🌊ボタン</strong>をタップすると、水の流れる音が<strong style={{ color: '#22d3ee' }}>フェードイン</strong>で流れます。もう一度タップでフェードアウトして停止します。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#67e8f9' }}>長押し</strong>（またはメニュー →「水の音」）で設定パネルが開き、音量・フェード時間・次回起動時の自動再生を変更できます。
                  </div>
                  <div>
                    音声コール中は<strong style={{ color: '#8b5cf6' }}>自動で音量が下がり</strong>、コールが終わると元に戻ります。iPhoneはマナーモードだと鳴りません。
                  </div>
                </div>
              </InfoCard>
            </Section>
          </>
        )}

        {/* ===== データ読込 ===== */}
        {tab === 'data' && (
          <>
            <Section title="対応ファイル形式" color="#22c55e">
              <InfoCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'コンテナ日程', color: '#60a5fa', desc: 'メインの作業ファイル。パレット数・端数・ケース数を含む。' },
                    { label: 'AQSS04L', color: '#8b5cf6', desc: 'Invoice形式。品番・数量から自動計算してコンテナ日程相当に変換。' },
                    { label: 'AQSS05L', color: '#a78bfa', desc: 'Packing List。04Lと併用で寸法・重量情報を追加。' },
                    { label: '品目一覧', color: '#34d399', desc: 'CNSマスタデータ。入数・1P数・寸法等を品番で自動紐付。' },
                    { label: 'JKP', color: '#f59e0b', desc: '出荷スケジュール。' },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: '#fff',
                        background: `${f.color}cc`, padding: '3px 8px',
                        borderRadius: 6, flexShrink: 0, minWidth: 50, textAlign: 'center',
                      }}>{f.label}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{f.desc}</span>
                    </div>
                  ))}
                </div>
              </InfoCard>
            </Section>

            <Section title="読込方法" color="#60a5fa">
              <Step num={1} title="ドラッグ＆ドロップ" icon="📂"
                desc="読込画面のドロップゾーンにExcelファイルをドラッグ＆ドロップ。複数ファイル同時対応。" />
              <Step num={2} title="Googleドライブ" icon="☁️"
                desc="「Googleドライブ」ボタンでCNSフォルダ内のファイルを選択。OAuth認証で安全にアクセス。" />
              <Step num={3} title="GitHubリポジトリ" icon="🐙"
                desc="「GitHub」ボタンでリポジトリ内のExcelファイルを直接読込。" />
              <Step num={4} title="最近のファイル" icon="🕐"
                desc="「履歴」ボタンで過去に読み込んだファイルをワンタップで再読込。" />
            </Section>

            <Section title="マスタデータ紐付" color="#8b5cf6">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    ファイル読込時に<strong style={{ color: '#8b5cf6' }}>GitHubから最新のCNS品目一覧を自動取得</strong>し、品番（新建高コード / 気高コード）で紐付。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    紐付により<strong style={{ color: '#22c55e' }}>入数・1P数・寸法・重量</strong>がマスタから自動補完され、パレット数・端数も自動計算されます。
                  </div>
                  <div>
                    AQSS04L単体でもマスタ紐付により<strong style={{ color: '#f59e0b' }}>コンテナ日程と同等の表示</strong>が可能です。
                  </div>
                </div>
              </InfoCard>
            </Section>
          </>
        )}

        {/* ===== 鍋ルール ===== */}
        {tab === 'nabe' && (
          <>
            <Section title="鍋コンテナの特別ルール" color="#ef4444">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 10 }}>
                    鍋（タイガー鍋）のコンテナには以下の専用ルールが適用されます:
                  </div>
                  {[
                    { icon: '🔢', title: 'サイズ分類', desc: '100サイズ（緑）と180サイズ（青）で自動分類。バッジ・分布バー・リスト全てにサイズ表示。' },
                    { icon: '📦', title: '1段6個統一', desc: 'JPI含む全種目で1段6個の積み方。3列×2行のグリッド配置。' },
                    { icon: '🔍', title: '検査なし', desc: '鍋は検査を抜かない（端数＝元の端数のまま）。' },
                    { icon: '📋', title: 'リスト順', desc: '①100サイズ→②180サイズ→③機種名アルファベット順で自動ソート。' },
                    { icon: '🔗', title: '関連品', desc: '類似品表示なし。同じサイズの品目を「関連」として表示。' },
                    { icon: '🔊', title: 'アナウンス', desc: '初回コール: 「100サイズがN種類、180サイズがN種類」。品目コールでのサイズ違い警告はなし。' },
                    { icon: '🎨', title: '背景色', desc: '機種別のカラーマッピング（nabeColors）に基づく独自の背景グラデーション。' },
                  ].map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, padding: '8px 0',
                      borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{r.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </InfoCard>
            </Section>

            <Section title="パレット寸法" color="#f59e0b">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#22c55e' }}>100サイズ</strong>: パレット110×110cmに3×38=114cmがぴったり収まる。奥行は2×55=110cm。
                  </div>
                  <div>
                    <strong style={{ color: '#3b82f6' }}>180サイズ</strong>: パレット110cmに対し3×42=126cmではみ出る。図でもはみ出し表現。箱はパレット中央に配置。
                  </div>
                </div>
              </InfoCard>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

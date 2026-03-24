'use client';

import { useState } from 'react';

interface ManualPageProps {
  onClose: () => void;
}

/* ===== ステップカード ===== */
function Step({ num, title, desc, icon }: { num: number; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 14, flexShrink: 0,
        background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#60a5fa', fontFamily: 'var(--font-mono)',
      }}>{num}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}{title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ===== ボタン説明カード ===== */
function BtnDesc({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        width: 40, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color,
      }}>{label}</div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{desc}</span>
    </div>
  );
}

/* ===== セクション ===== */
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 15, fontWeight: 700, color, marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 6, borderBottom: `2px solid ${color}40`,
      }}>
        <span style={{ width: 4, height: 16, borderRadius: 2, background: color }} />
        {title}
      </div>
      {children}
    </div>
  );
}

/* ===== 画面図解 ===== */
function ScreenDiagram() {
  return (
    <div style={{
      background: '#0d0f16', borderRadius: 16, padding: 12, marginBottom: 16,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* ヘッダー */}
      <div style={{
        background: '#1a1d2e', borderRadius: '10px 10px 0 0', padding: '6px 10px',
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
      }}>
        <div style={{ width: 20, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ width: 80, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ marginLeft: 'auto', width: 40, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* 上半分 - 作業エリア */}
      <div style={{
        background: 'linear-gradient(135deg, #121620, #1a2030)', borderRadius: 0,
        padding: 10, height: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden', marginBottom: 2,
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
          background: 'radial-gradient(ellipse at 80% 40%, rgba(34,197,94,0.15), transparent 70%)',
        }} />
        {/* バッジ */}
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 8, background: 'rgba(34,197,94,0.3)', color: '#4ade80', padding: '1px 6px', borderRadius: 4 }}>ポリカバー</span>
        </div>
        {/* コード */}
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 3, alignSelf: 'flex-start' }}>3TG383A10180</span>
        {/* 品名 */}
        <span style={{ fontSize: 16, fontWeight: 900, color: '#f0f0f0', letterSpacing: -0.5 }}>JPV-X100(W)</span>
        {/* 数量 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, zIndex: 1 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: 'rgba(34,197,94,0.8)' }}>@30</div>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#22c55e' }}>0</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginLeft: 2 }}>PL</span>
          </div>
          <div>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#e8e8e8' }}>19</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginLeft: 2 }}>CT</span>
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>190</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>pcs</span>
          </div>
        </div>
        {/* ラベル */}
        <div style={{
          position: 'absolute', right: 6, top: 6,
          fontSize: 7, color: 'rgba(255,255,255,0.3)', textAlign: 'right',
        }}>
          <div>作業エリア</div>
          <div>品目詳細表示</div>
        </div>
      </div>

      {/* 下半分 - リスト */}
      <div style={{ background: '#162218', borderRadius: '0 0 10px 10px', padding: '6px 8px' }}>
        {['JPH-A100', 'JPI-S100(WS)', 'JPV-X100(K)'].map((n, i) => (
          <div key={n} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
            borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', flex: 1 }}>{n}</span>
            <span style={{ fontSize: 9, color: '#22c55e', fontFamily: 'var(--font-mono)', width: 20, textAlign: 'center' }}>0</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', width: 20, textAlign: 'center' }}>10</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)', width: 30, textAlign: 'right' }}>100</span>
          </div>
        ))}
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 4 }}>品目リスト（スワイプで完了/元に戻す）</div>
      </div>

      {/* 操作バー */}
      <div style={{
        display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center',
      }}>
        {[
          { label: '<', color: 'rgba(255,255,255,0.3)' },
          { label: '+', color: 'rgba(59,130,246,0.5)' },
          { label: '♪', color: 'rgba(34,197,94,0.5)' },
          { label: 'CN', color: 'rgba(251,191,36,0.5)' },
          { label: '🎤', color: 'rgba(255,255,255,0.3)' },
          { label: '-', color: 'rgba(59,130,246,0.5)' },
          { label: '✓', color: 'rgba(239,68,68,0.5)' },
          { label: '>', color: 'rgba(255,255,255,0.3)' },
        ].map((b, i) => (
          <div key={i} style={{
            width: 28, height: 22, borderRadius: 6,
            background: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, color: '#fff',
          }}>{b.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ===== スワイプ図解 ===== */
function SwipeDiagram() {
  return (
    <div style={{
      background: '#0d0f16', borderRadius: 12, padding: 12, marginBottom: 8,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* 完了スワイプ */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>完了（左→右にスワイプ）</div>
        <div style={{ position: 'relative', height: 32, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #16a34a, #22c55e)', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓ 完了</span>
          </div>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '40%', right: 0,
            background: '#162218', display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8,
            borderRadius: '0 6px 6px 0',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>JPH-A100</span>
          </div>
          <div style={{ position: 'absolute', top: '50%', left: '30%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>→</div>
        </div>
      </div>
      {/* 元に戻すスワイプ */}
      <div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>元に戻す（右→左にスワイプ）</div>
        <div style={{ position: 'relative', height: 32, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(270deg, #dc2626, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>↩ 元に戻す</span>
          </div>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: '40%',
            background: '#1e1e22', display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#555' }} />
            <span style={{ fontSize: 10, color: '#666', textDecoration: 'line-through' }}>JPH-A100</span>
          </div>
          <div style={{ position: 'absolute', top: '50%', right: '30%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>←</div>
        </div>
      </div>
    </div>
  );
}

/* ===== 音声コマンド表 ===== */
function VoiceTable() {
  const cmds = [
    { word: '次 / つぎ', action: '次の品目へ' },
    { word: '前 / まえ', action: '前の品目へ' },
    { word: '完了', action: '現在の品目を完了' },
    { word: '読み上げ', action: '現在の品目をアナウンス' },
    { word: 'OK / オッケー', action: 'パレット1つ消費（0で自動完了）' },
    { word: '概要 / コンテナ', action: 'コンテナ概要をアナウンス' },
    { word: 'プラス / マイナス', action: 'パレット数を増減' },
    { word: '数量', action: '現在の数量を読み上げ' },
    { word: '残り', action: '残り品目数を読み上げ' },
    { word: 'パレット', action: 'パレット数を読み上げ' },
    { word: '端数', action: '端数ケース数を読み上げ' },
  ];
  return (
    <div style={{
      background: '#0d0f16', borderRadius: 12, padding: '2px 0',
      border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8,
    }}>
      {cmds.map((c, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', padding: '7px 12px',
          borderBottom: i < cmds.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
        }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#f59e0b',
            minWidth: 110, fontFamily: 'var(--font-mono)',
          }}>{c.word}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{c.action}</span>
        </div>
      ))}
    </div>
  );
}

/* ===== メインコンポーネント ===== */
export default function ManualPage({ onClose }: ManualPageProps) {
  const [tab, setTab] = useState<'basic' | 'voice' | 'manage'>('basic');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0f1119', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* ヘッダー */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: '#1a1d2e',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>操作マニュアル</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>CNS v1.2</span>
      </div>

      {/* タブ */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 16px',
        background: '#13151f', borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {([
          { id: 'basic', label: '基本操作' },
          { id: 'voice', label: '音声コマンド' },
          { id: 'manage', label: '管理機能' },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: tab === t.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: tab === t.id ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <div style={{ padding: '16px 16px 80px' }}>

        {/* ===== 基本操作 ===== */}
        {tab === 'basic' && (
          <>
            <Section title="作業の流れ" color="#60a5fa">
              <Step num={1} title="Excelファイルを読み込む"
                desc="ホーム画面でExcelファイルをドラッグ＆ドロップ、またはタップして選択します。「内容」シートからコンテナデータが読み込まれます。"
                icon={<span style={{ fontSize: 14 }}>📁</span>} />
              <Step num={2} title="概要アナウンスを確認"
                desc="読み込み完了後、コンテナの概要（品目数・種類・類似品の有無）が自動でアナウンスされます。"
                icon={<span style={{ fontSize: 14 }}>🔊</span>} />
              <Step num={3} title="品目を順番に確認"
                desc="< > ボタンまたは音声「次」「前」で品目を切り替え。パレット図・数量を確認します。"
                icon={<span style={{ fontSize: 14 }}>📋</span>} />
              <Step num={4} title="荷降ろし完了"
                desc="品目の荷降ろしが終わったら ✓ ボタン、リストのスワイプ、または音声「OK」で完了にします。"
                icon={<span style={{ fontSize: 14 }}>✅</span>} />
            </Section>

            <Section title="画面構成" color="#22c55e">
              <ScreenDiagram />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 12 }}>
                上半分に品目の詳細情報（コード・品名・パレット図・数量）、下半分に品目リストが表示されます。横画面では左右分割になります。
              </div>
            </Section>

            <Section title="操作バーのボタン" color="#8b5cf6">
              <BtnDesc color="#94a3b8" label="<  >" desc="前の品目 / 次の品目に移動" />
              <BtnDesc color="#3b82f6" label="+  -" desc="パレット数を増減（手動調整用）" />
              <BtnDesc color="#22c55e" label="♪" desc="現在の品目をアナウンス（読み上げ）" />
              <BtnDesc color="#d97706" label="CN" desc="コンテナ概要をアナウンス" />
              <BtnDesc color="#ef4444" label="🎤" desc="音声認識のON/OFF切替" />
              <BtnDesc color="#ef4444" label="✓" desc="現在の品目を完了にする" />
            </Section>

            <Section title="スワイプ操作" color="#f59e0b">
              <SwipeDiagram />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                リストの品目行を<strong style={{ color: '#4ade80' }}>右にスワイプ</strong>で完了、完了済みの行を<strong style={{ color: '#f87171' }}>左にスワイプ</strong>で元に戻せます。
              </div>
            </Section>

            <Section title="OKコマンド" color="#ef4444">
              <div style={{
                background: '#0d0f16', borderRadius: 12, padding: 14,
                border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>
                  音声「OK」でパレット自動消費
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { step: '「OK」と発声', result: 'パレットが1つ減る' },
                    { step: '残りを読み上げ', result: '「OK。残り2パレット」' },
                    { step: 'パレット0 & 端数0', result: '自動で完了処理' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                        background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#f87171',
                      }}>{i + 1}</div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 90 }}>{s.step}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>→</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{s.result}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ===== 音声コマンド ===== */}
        {tab === 'voice' && (
          <>
            <Section title="音声認識の使い方" color="#f59e0b">
              <Step num={1} title="音声認識を開始"
                desc="操作バーの🎤ボタンをタップして音声認識を開始します。ボタンが赤く点滅している間、音声を聞き取っています。"
                icon={<span style={{ fontSize: 14 }}>🎤</span>} />
              <Step num={2} title="コマンドを発声"
                desc="下記のキーワードをはっきりと発声してください。倉庫の騒音環境でも認識しやすいよう短いキーワードで設計されています。"
                icon={<span style={{ fontSize: 14 }}>🗣</span>} />
              <Step num={3} title="フィードバック確認"
                desc="認識されたテキストが画面上部にフローティング表示されます。コマンドが実行されるとアナウンスで結果をお知らせします。"
                icon={<span style={{ fontSize: 14 }}>💬</span>} />
            </Section>

            <Section title="コマンド一覧" color="#22c55e">
              <VoiceTable />
            </Section>

            <Section title="自動アナウンス" color="#60a5fa">
              <div style={{
                background: '#0d0f16', borderRadius: 12, padding: 14,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#60a5fa' }}>品目切替時</strong>: 品名・パレット数・ケース数を読み上げ。ポリカバーは検査分も計算。類似品がある場合は警告。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#22c55e' }}>コンテナ読み込み時</strong>: 合計品目数、種類別内訳、ジャーポットの有無、類似品の組数をアナウンス。
                  </div>
                  <div>
                    <strong style={{ color: '#f59e0b' }}>ヘッダーの🔊ボタン</strong>: 自動アナウンスのON/OFFを切り替えます。
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ===== 管理機能 ===== */}
        {tab === 'manage' && (
          <>
            <Section title="管理ページ" color="#8b5cf6">
              <Step num={1} title="メニューから「管理」を選択"
                desc="ハンバーガーメニュー（≡）をタップし、「管理」を選択します。品目のマスタデータを管理できます。"
                icon={<span style={{ fontSize: 14 }}>📝</span>} />
              <Step num={2} title="品目をタップして詳細表示"
                desc="品目行をタップすると4セクション（ベース情報・气高编号・コンテナ日程・AQSS）の全情報を確認・編集できます。"
                icon={<span style={{ fontSize: 14 }}>👆</span>} />
              <Step num={3} title="種類フィルター / 検索"
                desc="上部のチップボタンで種類フィルター、検索バーで品名・コード・説明文を検索できます。"
                icon={<span style={{ fontSize: 14 }}>🔍</span>} />
            </Section>

            <Section title="Import / Export" color="#22c55e">
              <div style={{
                background: '#0d0f16', borderRadius: 12, padding: 14,
                border: '1px solid rgba(255,255,255,0.08)', marginBottom: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 8 }}>Import（取り込み）</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 12 }}>
                  CNS品目一覧（全集約版）のExcelファイルを取り込み、品番が一致するアイテムのマスタデータ（新建高コード・气高编号・コンテナ日程・AQSS情報）を一括更新します。
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 8 }}>Export（出力）</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                  現在の品目データを全集約版フォーマット（21列）でExcelファイルに出力します。グループヘッダー（ベース情報・气高编号・コンテナ日程）付き。
                </div>
              </div>
            </Section>

            <Section title="CN優先ソート" color="#f59e0b">
              <div style={{
                background: '#0d0f16', borderRadius: 12, padding: 14,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                  管理ページ上部の「<strong style={{ color: '#fbbf24' }}>CN優先</strong>」ボタンをONにすると、現在のコンテナに含まれる品目が一覧の上部に自動ソートされます。左ボーダーと背景色で対象品目が視覚的に区別されます。
                </div>
              </div>
            </Section>

            <Section title="データ構造" color="#60a5fa">
              <div style={{
                background: '#0d0f16', borderRadius: 12, padding: 14,
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#60a5fa' }}>「内容」シート</strong>: コンテナごとの荷物情報。パレット枚数・端数を含む作業データ。
                  </div>
                  <div>
                    <strong style={{ color: '#8b5cf6' }}>CNS品目一覧</strong>: コード紐付・入数・1P数・重量・寸法等のマスタデータ。Importで取り込み、Exportで出力。
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

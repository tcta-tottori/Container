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
                desc="読込画面でExcelファイルをドラッグ＆ドロップ、または「Googleドライブ」ボタンから選択。コンテナ日程・AQSS04L両方に対応。" />
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

            <Section title="パレット数の手動増減" color="#38bdf8">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    作業画面の<strong style={{ color: '#7dd3fc' }}>PL（パレット数）をタップ</strong> → 1枚減らす（音声の「OK」と同じ）。
                  </div>
                  <div>
                    <strong style={{ color: '#7dd3fc' }}>ダブルタップ</strong> → 1枚戻す。
                    読み込んだ元の枚数を超えて増えることはありません。せせらぎモードでも同じ操作です。
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

            <Section title="ジャーポットの積み方" color="#c084fc">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#c084fc' }}>PDU の機種</strong>: 2箱がラミネート（シュリンク）でひとかたまり（1玉＝2ケース）になっています。
                    パレットの半面に<strong style={{ color: '#fbbf24' }}>横長置き2玉＋縦長置き3玉</strong>、
                    もう半面は互い違いに置いて、<strong style={{ color: '#fbbf24' }}>1段10玉（20ケース）</strong>。
                    2段目からは段ごとに互い違いに積みます。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#60a5fa' }}>段数</strong>: 30・40サイズは5段目まで、50サイズは4段目まで。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#38bdf8' }}>中央の隙間</strong>: 玉の大きさの都合でパレットにぴったりは収まらないため、
                    外側の辺に寄せて置き、中央が空きます。図もそのとおりに描いています。
                  </div>
                  <div>
                    <strong style={{ color: '#94a3b8' }}>PDZ など他の機種</strong>: これまでどおり1段4個の積み方です。
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="画面の見かた・クイックメニュー" color="#a78bfa">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#a78bfa' }}>ヘッダー</strong>は1行です。左がメニュー、中央が作業の経過時間（タップで品目別の時間・一時停止・リセット）、
                    右が気温・湿度と暑さ指数の色バッジ（緑→黄→オレンジ→赤で危険度）。バッジをタップすると詳細と推移グラフが開きます。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#fbbf24' }}>一時停止</strong>: 経過時間をタップして「一時停止」を押すと、休憩の間だけ時計を止められます。
                    止めている間は<strong style={{ color: '#fbbf24' }}>音声コール・水の音・せせらぎモードの映像と川の音も止まり</strong>、10分ごとのコールも数えません。
                    ヘッダーには「一時停止中」と出ます。もう一度押すと止めたところから続き、止めていた時間は経過時間に入りません。
                    せせらぎモード中は<strong style={{ color: '#f0cf95' }}>右上の経過時間をタップ</strong>しても止められます。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#60a5fa' }}>右下のボタン</strong>（上向きの山マーク）を押すと下からメニューが開き、
                    コンテナの選択・応援コール・天気コール・水の音・せせらぎモード・SwitchBot 接続をまとめて操作できます。
                    開いている間はマークが下向きになります。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#a78bfa' }}>ヘッダーを下にスワイプ</strong>するとアプリを更新（再読み込み）できます。
                    矢印が出て、下向きから上向きに変わったところで指を離してください。
                    コンテナを読み込んでいるときは、作業内容が消えてしまうので確認画面が出ます。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    作業ページで<strong style={{ color: '#38bdf8' }}>ヘッダーを左右どちらかにスワイプ</strong>すると、
                    そのまませせらぎモードに入れます。
                  </div>
                  <div>
                    このアプリは<strong style={{ color: '#a78bfa' }}>縦画面専用</strong>です。
                    スマホを横にすると「画面を縦にしてください」と表示されます。
                  </div>
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
                    <strong style={{ color: '#60a5fa' }}>品目切替時</strong>: 品名・パレット数・ケース数を読み上げ。品名は画面の表示名だけ（部品の詳しい型式までは読みません）。
                    数量は画面の PL / CT と同じ値で、ポリカバーなど検査を抜く品目は<strong style={{ color: '#fbbf24' }}>抜いた後の数</strong>をコールします。
                    類似品がある場合は「類似品があります」とだけコール（品名・数量は読み上げません）。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#22c55e' }}>コンテナ読み込み時</strong>: コールなし（「荷降ろしを開始します」や内容案内は読み上げません）。最初の品目コールだけ鳴ります。
                    メニューの概要コールを押したときは「残り○品」と類似品の注意だけを伝えます。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#ef4444' }}>OKコマンド後</strong>: 「残り○パレットと○ケース。」のみコール（次の品目コールはなし）。
                    パレット数を戻したときはコールしません（画面表示のみ）。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#f59e0b' }}>10分ごとのコール</strong>: 「○分経過しました」のみ。
                    気温・湿度は既定ではコールしません（設定 →「音声・コール」の「コールの内容」でオンにすると、暑さ指数と警戒レベルまで付きます）。一時停止中は数えません。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#38bdf8' }}>気温・天気コール</strong>: 気温・湿度・暑さ指数と警戒レベルの数値のみ。「休憩してください」等のアドバイスはコールしません。
                  </div>
                  <div>
                    <strong style={{ color: '#a78bfa' }}>声・トーンの設定</strong>: メニュー →「設定」→「音声・コール」で、使う音声API・話す人・トーン・速さ・音量を変更できます（通常コールと応援コールで別々に設定）。
                    音声 API は <strong>Gemini TTS</strong>（高品質・通信あり）、<strong>sherpa-onnx</strong>（端末内で高音質・通信なし）、<strong>端末の音声</strong>から選べます。
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="せせらぎモード" color="#38bdf8">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    右下のメニュー →<strong style={{ color: '#7dd3fc' }}>「せせらぎモード」</strong>、または
                    作業ページで<strong style={{ color: '#7dd3fc' }}>ヘッダーを左右にスワイプ</strong>すると、川の映像を全画面表示します。
                    継ぎ目が分からないようにつないだループ映像で、水の音も一緒に流れ始めます。
                    入るときと出るときは<strong style={{ color: '#7dd3fc' }}>靄</strong>がかかって切り替わります。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    映像は<strong style={{ color: '#7dd3fc' }}>ステータスバーの領域まで全画面</strong>で流れます。
                    上端は<strong style={{ color: '#7dd3fc' }}>左に現在時刻</strong>、
                    <strong style={{ color: '#f0cf95' }}>右に作業の経過時間</strong>（タップで一時停止・再開）、
                    その下に<strong style={{ color: '#fb923c' }}>気温</strong>と<strong style={{ color: '#38bdf8' }}>湿度</strong>だけを表示します。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    開いた直後は映像だけで、品目情報は出ません。
                    <strong style={{ color: '#7dd3fc' }}>画面をタップ</strong>すると水滴が落ちたような波紋が広がり、
                    いま作業中の機種名とパレット・カートン・pcs が、画面中ほどの水面からまとめて浮かび上がります。
                    カートンと pcs は作業画面と同じように数字が動いて表示されます。
                    表示中にもう一度ほかの場所をタップすると、そのまま水面の下へ入って消えます（しばらく置いても自動で沈みます）。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    浮かんでいる<strong style={{ color: '#7dd3fc' }}>機種名を上下にスワイプ</strong>すると品目を切り替えられます
                    （上で次の品目・下で前の品目）。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    浮かんでいる<strong style={{ color: '#7dd3fc' }}>パレット数（PL）をタップ</strong>すると
                    パレットを1枚減らし（残り0枚のときは品目が完了）、
                    <strong style={{ color: '#7dd3fc' }}>ダブルタップ</strong>で1枚戻せます（元の枚数が上限）。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: '#22c55e' }}>カートン数（CT）をタップ</strong>すると、端数パレットの積み方を
                    作業画面と同じように全画面で表示します（回りながら広がり、7秒で戻ります）。
                    残りが端数ケースだけになった品目では、切り替えたときに自動で表示されます。
                    <strong style={{ color: '#7dd3fc' }}>横スワイプで手回し</strong>でき、図をタップするとすぐ戻ります。
                  </div>
                  <div>
                    元の画面に戻るときは
                    <strong style={{ color: '#7dd3fc' }}>画面を左右どちらかに大きくスワイプ</strong>してください。
                    操作の案内は開いた直後に画面下へ3秒ほど薄く出ます。
                  </div>
                </div>
              </InfoCard>
            </Section>

            <Section title="作業用BGM（水の音）" color="#22d3ee">
              <InfoCard>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8 }}>
                    右下のメニュー →<strong style={{ color: '#67e8f9' }}>「水の音を流す」</strong>をタップすると、水の流れる音が<strong style={{ color: '#22d3ee' }}>フェードイン</strong>で流れます。もう一度タップでフェードアウトして停止します。
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    行の右にある<strong style={{ color: '#67e8f9' }}>歯車</strong>（またはメニュー →「設定」→「水の音」）で設定が開き、音量・フェード時間・次回起動時の自動再生を変更できます。
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
              <Step num={3} title="最近のファイル" icon="🕐"
                desc="メニュー →「履歴」→「最近のファイル」で、過去に読み込んだファイルをワンタップで再読込。" />
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
                    { icon: '🔊', title: 'アナウンス', desc: '読み込み時の概要コールは廃止。品目コールでのサイズ違い警告もなし。' },
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

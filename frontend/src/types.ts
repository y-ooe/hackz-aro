// バックエンド(AIエージェント)と通信する際の共通型定義

/** チャットの1メッセージ */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** セッションの状態 */
export type SessionStatus = 'draft' | 'deployed'

/** デプロイ時のレアリティ種別 */
export type Rarity = 'common' | 'rare' | 'ssr'

/** デプロイ先の種別 */
export type DeployTarget = 'ec2' | 's3'

/** デプロイ時の「サーバー大きさガチャ」結果(EC2のときのみ) */
export interface DeployGacha {
  instanceType: string
  rarity: Rarity
  rarityLabel: string
  emoji: string
}

/** デプロイ時の「ガチャ」全体の結果(デプロイ先 + EC2ならサーバー大きさ) */
export interface DeployOutcome {
  target: DeployTarget
  targetLabel: string
  targetEmoji: string
  /** EC2 のときのみ。S3 のときは null */
  size: DeployGacha | null
}

/** localStorage に保存する、画面の全状態(DB代わり) */
export interface PersistedState {
  projectName: string
  messages: ChatMessage[]
  currentJsx: string | null
  status: SessionStatus
  deployUrl: string | null
  deployOutcome: DeployOutcome | null
}

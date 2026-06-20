// バックエンド(AIエージェント)と通信する際の共通型定義

/** デプロイ先クラウドの選択肢 */
export type TargetCloud = 'vercel' | 'aws' | 'gcp' | 'cloudflare'

/** チャットの1メッセージ */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** セッションの状態 */
export type SessionStatus = 'draft' | 'deployed'

/** localStorage に保存する、画面の全状態(DB代わり) */
export interface PersistedState {
  projectName: string
  targetCloud: TargetCloud
  messages: ChatMessage[]
  currentJsx: string | null
  status: SessionStatus
  deployUrl: string | null
}

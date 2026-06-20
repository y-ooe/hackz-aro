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

/** GET /api/sessions/:id のレスポンス */
export interface SessionState {
  sessionId: number
  projectName: string
  targetCloud: TargetCloud
  status: SessionStatus
  deployUrl: string | null
  hasPreview: boolean
  messages: ChatMessage[]
}

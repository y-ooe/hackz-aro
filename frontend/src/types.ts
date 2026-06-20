// バックエンド(AIエージェント)と通信する際の共通型定義

/** ログの種別。ターミナル表示の色分けにも使う */
export type LogLevel = 'info' | 'thought' | 'tool' | 'success' | 'error'

/** バックエンドからストリーミングで送られてくる1行分のログ */
export interface LogEntry {
  level: LogLevel
  message: string
  /** 受信時刻(ミリ秒)。表示用 */
  timestamp: number
}

/** デプロイ先クラウドの選択肢 */
export type TargetCloud = 'vercel' | 'aws' | 'gcp' | 'cloudflare'

/** POST /api/deploy に送るリクエストボディ */
export interface DeployRequest {
  projectName: string
  targetCloud: TargetCloud
  prompt: string
}

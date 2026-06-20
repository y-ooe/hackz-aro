import type { DeployRequest } from './types'

/** 指定ミリ秒待つ */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * バックエンド未接続でもUIを確認できるようにするためのモックストリーム。
 *
 * 本番(POST /api/deploy)が返すのと同じ「1行=1つのJSON文字列」を、
 * 実際のストリーミングのように少しずつ onChunk へ流す。
 * App.tsx 側は本番と同じ handleStreamChunk でパースできる。
 *
 * @param req    入力フォームの内容(ログ文面に反映する)
 * @param onChunk 受信した1行(JSON文字列)を渡すコールバック
 */
export async function runMockStream(
  req: DeployRequest,
  onChunk: (raw: string) => void,
): Promise<void> {
  // { level, message } 形式のログ。完了時のみ { url } を流す。
  const script: Array<{ wait: number; payload: Record<string, unknown> }> = [
    { wait: 400, payload: { level: 'thought', message: `要件を解析しています: "${req.prompt.slice(0, 40)}..."` } },
    { wait: 600, payload: { level: 'thought', message: 'アプリ構成を決定: React + Vite フロントエンド' } },
    { wait: 500, payload: { level: 'tool', message: 'MCP: filesystem.write → package.json を生成' } },
    { wait: 500, payload: { level: 'tool', message: 'MCP: filesystem.write → Dockerfile を生成' } },
    { wait: 700, payload: { level: 'tool', message: `MCP: ${req.targetCloud}.provision → インフラ構成を作成中` } },
    { wait: 800, payload: { level: 'info', message: 'terraform init を実行' } },
    { wait: 900, payload: { level: 'info', message: 'terraform apply を実行 (リソースを作成中…)' } },
    { wait: 700, payload: { level: 'tool', message: `MCP: ${req.targetCloud}.deploy → ビルド成果物をアップロード` } },
    { wait: 600, payload: { level: 'success', message: 'ヘルスチェック通過 (HTTP 200)' } },
    // 完了イベント: url を含めると App 側で resultUrl にセットされる
    { wait: 500, payload: { url: `https://${req.projectName || 'my-app'}.${req.targetCloud}.app` } },
  ]

  for (const step of script) {
    await delay(step.wait)
    onChunk(JSON.stringify(step.payload))
  }
}

import { useCallback, useState } from 'react'
import { InputPanel } from './components/InputPanel'
import { LogConsole } from './components/LogConsole'
import { ResultPanel } from './components/ResultPanel'
import { runMockStream } from './mockStream'
import type { DeployRequest, LogEntry, LogLevel, TargetCloud } from './types'

// === モック / 本番 の切り替えフラグ ===
// true  : バックエンド未接続でも動くモックストリームを使用(デモ用)
// false : 本番。実際に POST /api/deploy へリクエストする
// 環境変数 VITE_USE_MOCK=false を .env に設定すると本番モードになる。
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

function App() {
  // === State 管理 ===
  const [prompt, setPrompt] = useState('')
  const [projectName, setProjectName] = useState('')
  const [targetCloud, setTargetCloud] = useState<TargetCloud>('vercel')
  const [isGenerating, setIsGenerating] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  /** ログを1行追加するヘルパー */
  const appendLog = useCallback((level: LogLevel, message: string) => {
    setLogs((prev) => [...prev, { level, message, timestamp: Date.now() }])
  }, [])

  /**
   * 「Generate & Deploy」実行ハンドラ。
   * POST /api/deploy にリクエストを送り、バックエンドからストリーミングで
   * 送られてくる実行ログを順次 logs State に追加していく。
   */
  const handleGenerate = useCallback(async () => {
    if (isGenerating) return

    // 実行開始: 状態をリセット
    setIsGenerating(true)
    setLogs([])
    setResultUrl(null)
    appendLog('info', `Starting build for "${projectName}" → ${targetCloud}`)

    const body: DeployRequest = { projectName, targetCloud, prompt }

    try {
      if (USE_MOCK) {
        // -----------------------------------------------------------------
        // モック: バックエンド未接続でもUIを確認できるデモ用ストリーム。
        // 本番と同じ handleStreamChunk でパースされる。
        // -----------------------------------------------------------------
        await runMockStream(body, handleStreamChunk)
      } else {
        // -----------------------------------------------------------------
        // 本番: バックエンド(Express)へのストリーミングリクエスト
        // -----------------------------------------------------------------
        const response = await fetch('/api/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok || !response.body) {
          throw new Error(`Request failed: ${response.status}`)
        }

        // fetch の ReadableStream を逐次読み取り、行(NDJSON)ごとに処理する。
        // バックエンドは 1行 = 1つのJSONログ ({ level, message } / 完了時は { url })
        // を改行区切りで流す想定。SSE の場合は "data: " プレフィックスを剥がす。
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // 最後の要素は未完の行かもしれないのでバッファに残す
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            handleStreamChunk(trimmed)
          }
        }
        // 残ったバッファを処理
        if (buffer.trim()) handleStreamChunk(buffer.trim())
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      appendLog('error', `Deployment failed: ${message}`)
    } finally {
      setIsGenerating(false)
    }
  }, [appendLog, isGenerating, projectName, prompt, targetCloud])

  /**
   * ストリームから受信した1行(JSON文字列)をパースして State に反映する。
   * - { level, message } → ログに追加
   * - { url } → 完了URLとして resultUrl に格納
   */
  function handleStreamChunk(raw: string) {
    // SSE 形式("data: {...}")にも一応対応
    const json = raw.startsWith('data:') ? raw.slice(5).trim() : raw
    try {
      const event = JSON.parse(json) as {
        level?: LogLevel
        message?: string
        url?: string
      }
      if (event.url) {
        setResultUrl(event.url)
        appendLog('success', `Deployed: ${event.url}`)
      } else if (event.message) {
        appendLog(event.level ?? 'info', event.message)
      }
    } catch {
      // JSONでなければそのまま info ログとして表示
      appendLog('info', raw)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* ヘッダー */}
      <header className="flex items-center gap-3 border-b border-neutral-800 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-lg">
          ⚡
        </div>
        <div>
          <h1 className="text-base font-semibold text-neutral-100">
            Infra Agent
          </h1>
          <p className="text-xs text-neutral-500">
            AI-powered infrastructure builder
          </p>
        </div>
        <span className="ml-auto rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-400">
          MCP enabled
        </span>
      </header>

      {/* メイン: 左=入力 / 右=コンソール */}
      <main className="grid grid-cols-1 gap-5 p-6 lg:h-[calc(100vh-69px)] lg:grid-cols-[minmax(360px,420px)_1fr]">
        {/* 左カラム */}
        <div className="flex min-h-0 flex-col gap-5 lg:overflow-y-auto">
          <InputPanel
            projectName={projectName}
            onProjectNameChange={setProjectName}
            targetCloud={targetCloud}
            onTargetCloudChange={setTargetCloud}
            prompt={prompt}
            onPromptChange={setPrompt}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
          />
          <ResultPanel resultUrl={resultUrl} />
        </div>

        {/* 右カラム: ログコンソール */}
        <div className="min-h-[420px] lg:min-h-0">
          <LogConsole logs={logs} isGenerating={isGenerating} />
        </div>
      </main>
    </div>
  )
}

export default App

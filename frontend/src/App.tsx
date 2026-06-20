import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { PreviewPanel } from './components/PreviewPanel'
import type {
  ChatMessage,
  PersistedState,
  SessionStatus,
  TargetCloud,
} from './types'

// DBの代わりに、画面の全状態を localStorage に保存する
const STORAGE_KEY = 'infra-agent-state'

function App() {
  const [projectName, setProjectName] = useState('my-app')
  const [targetCloud, setTargetCloud] = useState<TargetCloud>('vercel')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentJsx, setCurrentJsx] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [status, setStatus] = useState<SessionStatus>('draft')
  const [deployUrl, setDeployUrl] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)

  // 初回ロードでの復元が終わるまでは保存しない(空状態の上書き防止)
  const restored = useRef(false)

  // リロード時: localStorage から状態を復帰
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const s = JSON.parse(saved) as Partial<PersistedState>
        setProjectName(s.projectName ?? 'my-app')
        setTargetCloud(s.targetCloud ?? 'vercel')
        setMessages(s.messages ?? [])
        setCurrentJsx(s.currentJsx ?? null)
        setStatus(s.status ?? 'draft')
        setDeployUrl(s.deployUrl ?? null)
        if (s.currentJsx) setPreviewKey(Date.now())
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    restored.current = true
  }, [])

  // 状態が変わるたびに localStorage へ保存
  useEffect(() => {
    if (!restored.current) return
    const state: PersistedState = {
      projectName,
      targetCloud,
      messages,
      currentJsx,
      status,
      deployUrl,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [projectName, targetCloud, messages, currentJsx, status, deployUrl])

  /** チャット送信 */
  const handleSend = useCallback(
    async (text: string) => {
      if (isSending) return
      setIsSending(true)
      // 送信時点の履歴をサーバーに渡す(新規発言は含めない)
      const history = messages
      setMessages((prev) => [...prev, { role: 'user', content: text }])

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history, currentJsx, message: text }),
        })
        if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`)

        // NDJSON を逐次読み取り
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        const handleLine = (line: string) => {
          const trimmed = line.trim()
          if (!trimmed) return
          try {
            const event = JSON.parse(trimmed) as { type: string; text?: string }
            if (event.type === 'reply' && event.text) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: event.text! },
              ])
            } else if (event.type === 'jsx' && event.text) {
              // 更新後のJSXを保持し、プレビューを差し替える
              setCurrentJsx(event.text)
              setStatus('draft') // 修正したので未デプロイ扱いに戻す
              setDeployUrl(null)
              setPreviewKey(Date.now())
            } else if (event.type === 'error' && event.text) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `エラー: ${event.text}` },
              ])
            }
          } catch {
            // パースできない行は無視
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) handleLine(line)
        }
        if (buffer.trim()) handleLine(buffer)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `エラー: ${msg}` },
        ])
      } finally {
        setIsSending(false)
      }
    },
    [messages, currentJsx, isSending]
  )

  /** デプロイ */
  const handleDeploy = useCallback(async () => {
    if (!currentJsx || isDeploying) return
    setIsDeploying(true)
    try {
      const res = await fetch('/api/deploy-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, jsx: currentJsx }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'デプロイに失敗しました')
      setStatus('deployed')
      setDeployUrl(data.url ?? null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `デプロイ失敗: ${msg}` },
      ])
    } finally {
      setIsDeploying(false)
    }
  }, [currentJsx, projectName, isDeploying])

  /** 現在の状態を破棄して、新規状態にリセットする */
  const handleNewSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setMessages([])
    setCurrentJsx(null)
    setStatus('draft')
    setDeployUrl(null)
    setPreviewKey(Date.now())
  }, [])

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-200">
      {/* ヘッダー */}
      <header className="flex items-center gap-3 border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Infra Agent</h1>
          <p className="text-xs text-neutral-500">要望を伝えてアプリを作成・プレビュー・デプロイ</p>
        </div>
        <button
          type="button"
          onClick={handleNewSession}
          disabled={isSending}
          className="ml-auto rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-red-500/60 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          リセット
        </button>
      </header>

      {/* メイン: 左=プレビュー / 右=チャット */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-6 lg:grid-cols-[1fr_minmax(360px,440px)]">
        <PreviewPanel
          jsx={currentJsx}
          previewKey={previewKey}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          targetCloud={targetCloud}
          onTargetCloudChange={setTargetCloud}
          configLocked={false}
          status={status}
          deployUrl={deployUrl}
          isDeploying={isDeploying}
          onDeploy={handleDeploy}
        />
        <ChatPanel
          messages={messages}
          isSending={isSending}
          onSend={handleSend}
        />
      </main>
    </div>
  )
}

export default App

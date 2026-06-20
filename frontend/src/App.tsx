import { useCallback, useEffect, useState } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { PreviewPanel } from './components/PreviewPanel'
import type { ChatMessage, SessionState, SessionStatus, TargetCloud } from './types'

const STORAGE_KEY = 'infra-agent-session-id'

function App() {
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [projectName, setProjectName] = useState('my-app')
  const [targetCloud, setTargetCloud] = useState<TargetCloud>('vercel')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [previewKey, setPreviewKey] = useState(0)
  const [hasPreview, setHasPreview] = useState(false)
  const [status, setStatus] = useState<SessionStatus>('draft')
  const [deployUrl, setDeployUrl] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)

  // リロード時: localStorage に保存した sessionId から状態を復帰
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    const id = Number(saved)
    if (!Number.isInteger(id)) return

    fetch(`/api/sessions/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((state: SessionState) => {
        setSessionId(state.sessionId)
        setProjectName(state.projectName)
        setTargetCloud(state.targetCloud)
        setMessages(state.messages)
        setHasPreview(state.hasPreview)
        setStatus(state.status)
        setDeployUrl(state.deployUrl)
        if (state.hasPreview) setPreviewKey(Date.now())
      })
      .catch(() => localStorage.removeItem(STORAGE_KEY))
  }, [])

  /** 必要ならセッションを作成し、その id を返す */
  const ensureSession = useCallback(async (): Promise<number> => {
    if (sessionId) return sessionId
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, targetCloud }),
    })
    if (!res.ok) throw new Error('セッションの作成に失敗しました')
    const { sessionId: id } = (await res.json()) as { sessionId: number }
    setSessionId(id)
    localStorage.setItem(STORAGE_KEY, String(id))
    return id
  }, [sessionId, projectName, targetCloud])

  /** チャット送信 */
  const handleSend = useCallback(
    async (text: string) => {
      if (isSending) return
      setIsSending(true)
      setMessages((prev) => [...prev, { role: 'user', content: text }])

      try {
        const id = await ensureSession()

        const res = await fetch(`/api/sessions/${id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
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
            const event = JSON.parse(trimmed) as {
              type: string
              text?: string
            }
            if (event.type === 'reply' && event.text) {
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: event.text! },
              ])
            } else if (event.type === 'preview_updated') {
              setHasPreview(true)
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
    [ensureSession, isSending]
  )

  /** デプロイ */
  const handleDeploy = useCallback(async () => {
    if (!sessionId || isDeploying) return
    setIsDeploying(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [sessionId, isDeploying])

  /** 現在のセッションを削除して、新規状態にリセットする */
  const handleNewSession = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      } catch {
        // 削除に失敗してもローカルはリセットする
      }
    }
    localStorage.removeItem(STORAGE_KEY)
    setSessionId(null)
    setMessages([])
    setHasPreview(false)
    setStatus('draft')
    setDeployUrl(null)
    setPreviewKey(Date.now())
  }, [sessionId])

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-200">
      {/* ヘッダー */}
      <header className="flex items-center gap-3 border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-neutral-100">Infract</h1>
          <p className="text-xs text-neutral-500">全部つくるぜ！！！</p>
        </div>
        <button
          type="button"
          onClick={handleNewSession}
          disabled={isSending}
          className="ml-auto rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-red-500/60 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          セッションを削除
        </button>
      </header>

      {/* メイン: 左=プレビュー / 右=チャット */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-6 lg:grid-cols-[1fr_minmax(360px,440px)]">
        <PreviewPanel
          sessionId={sessionId}
          previewKey={previewKey}
          hasPreview={hasPreview}
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

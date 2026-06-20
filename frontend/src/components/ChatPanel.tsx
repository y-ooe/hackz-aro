import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'

interface ChatPanelProps {
  messages: ChatMessage[]
  isSending: boolean
  onSend: (text: string) => void
}

/**
 * 右カラム: AIとの対話チャット。
 * メッセージ履歴を吹き出しで表示し、下部の入力欄から送信する。
 */
export function ChatPanel({ messages, isSending, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const canSend = draft.trim() !== '' && !isSending

  const submit = () => {
    if (!canSend) return
    onSend(draft.trim())
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/80 px-4 py-3">
        <span className="text-sm font-semibold text-neutral-100">💬 Chat</span>
        <span className="text-xs text-neutral-500">
          AIと対話してアプリを作成・修正
        </span>
        {isSending && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-violet-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
            thinking
          </span>
        )}
      </div>

      {/* メッセージ履歴 */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-neutral-600">
            作りたいアプリを入力してください。
            <br />
            例:「シンプルな電卓アプリを作って」
          </p>
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} />)
        )}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-neutral-800 px-4 py-2.5 text-neutral-400">
              <span className="inline-flex gap-1">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="border-t border-neutral-800 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            disabled={isSending}
            rows={2}
            placeholder="メッセージを入力 (Enterで送信 / Shift+Enterで改行)"
            className="max-h-32 flex-1 resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            送信
          </button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-violet-600 text-white'
            : 'rounded-bl-sm bg-neutral-800 text-neutral-100'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500"
      style={{ animationDelay: delay }}
    />
  )
}

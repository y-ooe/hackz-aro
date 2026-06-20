import { useEffect, useRef } from 'react'
import type { LogEntry, LogLevel } from '../types'

interface LogConsoleProps {
  logs: LogEntry[]
  isGenerating: boolean
}

/** ログ種別ごとの表示色とプレフィックス */
const LEVEL_STYLE: Record<LogLevel, { color: string; prefix: string }> = {
  info: { color: 'text-neutral-400', prefix: '•' },
  thought: { color: 'text-sky-400', prefix: '🧠' },
  tool: { color: 'text-amber-400', prefix: '🔧' },
  success: { color: 'text-emerald-400', prefix: '✓' },
  error: { color: 'text-red-400', prefix: '✕' },
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ja-JP', { hour12: false })
}

/**
 * 右カラム: ターミナル風のリアルタイムログ表示。
 * 新しいログが追加されるたびに最下部へ自動スクロールする。
 */
export function LogConsole({ logs, isGenerating }: LogConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // logs が更新されるたびに一番下までスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-black">
      {/* ターミナルのヘッダーバー */}
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/80 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-500/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <span className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs font-medium text-neutral-400">
          agent — console
        </span>
        {isGenerating && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-violet-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
            running
          </span>
        )}
      </div>

      {/* ログ本体 */}
      <div className="terminal-scroll flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed">
        {logs.length === 0 ? (
          <p className="text-neutral-600">
            $ ここにエージェントの思考プロセスとMCPツールの実行ログが表示されます…
          </p>
        ) : (
          logs.map((log, i) => {
            const style = LEVEL_STYLE[log.level]
            return (
              <div key={i} className="flex gap-2 whitespace-pre-wrap break-words">
                <span className="select-none text-neutral-600">
                  {formatTime(log.timestamp)}
                </span>
                <span className={style.color}>
                  {style.prefix} {log.message}
                </span>
              </div>
            )
          })
        )}
        {/* 自動スクロールの基準点 */}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

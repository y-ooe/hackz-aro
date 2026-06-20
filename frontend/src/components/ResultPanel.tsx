interface ResultPanelProps {
  resultUrl: string | null
}

/**
 * デプロイ完了時に表示される成功メッセージ & 発行URL。
 * resultUrl が null の間は何も表示しない。
 */
export function ResultPanel({ resultUrl }: ResultPanelProps) {
  if (!resultUrl) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-sm text-black">
          ✓
        </span>
        <h2 className="text-sm font-semibold text-emerald-300">
          Deployment Successful
        </h2>
      </div>

      <p className="text-xs text-emerald-200/70">
        アプリのデプロイが完了しました。下記URLから確認できます。
      </p>

      <a
        href={resultUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 rounded-lg border border-emerald-700/40 bg-black/30 px-3 py-2.5 font-mono text-sm text-emerald-300 transition hover:border-emerald-500 hover:bg-black/50"
      >
        <span className="truncate">{resultUrl}</span>
        <span aria-hidden className="shrink-0 text-emerald-400">
          ↗
        </span>
      </a>
    </div>
  )
}

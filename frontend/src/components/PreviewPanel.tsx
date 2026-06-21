import { useMemo } from 'react'
import type { DeployOutcome, Rarity, SessionStatus, TargetCloud } from '../types'
import { renderPreviewHtml } from '../lib/renderPreview'

const CLOUD_OPTIONS: { value: TargetCloud; label: string }[] = [
  { value: 'vercel', label: 'Vercel' },
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'Google Cloud' },
  { value: 'cloudflare', label: 'Cloudflare' },
]

// レアリティごとの見た目(枠線・文字色・背景)
const RARITY_STYLE: Record<Rarity, string> = {
  common: 'border-neutral-600 bg-neutral-800/60 text-neutral-200',
  rare: 'border-sky-500/60 bg-sky-950/40 text-sky-200',
  ssr: 'border-amber-400/70 bg-amber-950/40 text-amber-200',
}

interface PreviewPanelProps {
  /** 現在の生成コード(.jsx)。無ければ null */
  jsx: string | null
  previewKey: number
  projectName: string
  onProjectNameChange: (value: string) => void
  targetCloud: TargetCloud
  onTargetCloudChange: (value: TargetCloud) => void
  /** セッション開始前のみ設定を編集できる */
  configLocked: boolean
  status: SessionStatus
  deployUrl: string | null
  /** デプロイ時に引いた「ガチャ」結果(デプロイ先 + EC2ならサーバー大きさ) */
  deployOutcome: DeployOutcome | null
  isDeploying: boolean
  onDeploy: () => void
}

/**
 * 左カラム: 生成アプリのプレビュー(iframe) + プロジェクト設定 + デプロイボタン。
 */
export function PreviewPanel({
  jsx,
  previewKey,
  projectName,
  onProjectNameChange,
  targetCloud,
  onTargetCloudChange,
  configLocked,
  status,
  deployUrl,
  deployOutcome,
  isDeploying,
  onDeploy,
}: PreviewPanelProps) {
  // JSXから、iframeに流し込むプレビューHTMLを生成する
  const previewHtml = useMemo(
    () => (jsx ? renderPreviewHtml(jsx) : null),
    [jsx]
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50">
      {/* ヘッダー: プロジェクト設定 + デプロイ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900/80 px-4 py-3">
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          disabled={configLocked}
          placeholder="project-name"
          className="w-40 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none transition focus:border-neutral-500 disabled:opacity-60"
        />
        <select
          value={targetCloud}
          onChange={(e) => onTargetCloudChange(e.target.value as TargetCloud)}
          disabled={configLocked}
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none transition focus:border-neutral-500 disabled:opacity-60"
        >
          {CLOUD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onDeploy}
          disabled={!jsx || isDeploying}
          className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {isDeploying ? 'デプロイ中…' : status === 'deployed' ? 'デプロイ済み' : 'デプロイ'}
        </button>
      </div>

      {/* 「運」: デプロイ先ガチャ + (EC2なら)サーバー大きさガチャの結果 */}
      {status === 'deployed' && deployOutcome && (
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 text-xs">
          {/* デプロイ先バッジ */}
          <span className="flex items-center gap-1.5 rounded-full border border-neutral-600 bg-neutral-800/60 px-2.5 py-1 text-neutral-200">
            <span className="text-base">{deployOutcome.targetEmoji}</span>
            <span className="opacity-70">デプロイ先: </span>
            <span className="font-semibold">{deployOutcome.targetLabel}</span>
          </span>

          {/* サーバー大きさバッジ(EC2のときのみ) */}
          {deployOutcome.size && (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${RARITY_STYLE[deployOutcome.size.rarity]}`}
            >
              <span className="text-base">{deployOutcome.size.emoji}</span>
              <span className="font-semibold">{deployOutcome.size.rarityLabel}</span>
              <span className="opacity-70">サーバー: </span>
              <span className="font-mono">{deployOutcome.size.instanceType}</span>
            </span>
          )}
        </div>
      )}

      {/* デプロイ完了URL */}
      {status === 'deployed' && deployUrl && (
        <a
          href={deployUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-neutral-800 bg-neutral-900/60 px-4 py-2 font-mono text-xs text-neutral-400 hover:text-neutral-200"
        >
          {deployUrl}
        </a>
      )}

      {/* プレビュー本体 */}
      <div className="flex-1 bg-white">
        {previewHtml ? (
          <iframe
            key={previewKey}
            srcDoc={previewHtml}
            title="preview"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-neutral-950 text-sm text-neutral-600">
            右のチャットでアプリを作成すると、ここにプレビューが表示されます
          </div>
        )}
      </div>
    </div>
  )
}

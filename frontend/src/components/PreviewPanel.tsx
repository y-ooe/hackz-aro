import type { SessionStatus, TargetCloud } from '../types'

const CLOUD_OPTIONS: { value: TargetCloud; label: string }[] = [
  { value: 'vercel', label: 'Vercel' },
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'Google Cloud' },
  { value: 'cloudflare', label: 'Cloudflare' },
]

const API_ORIGIN = 'http://localhost:3000'

interface PreviewPanelProps {
  sessionId: number | null
  previewKey: number
  hasPreview: boolean
  projectName: string
  onProjectNameChange: (value: string) => void
  targetCloud: TargetCloud
  onTargetCloudChange: (value: TargetCloud) => void
  /** セッション開始前のみ設定を編集できる */
  configLocked: boolean
  status: SessionStatus
  deployUrl: string | null
  isDeploying: boolean
  onDeploy: () => void
}

/**
 * 左カラム: 生成アプリのプレビュー(iframe) + プロジェクト設定 + デプロイボタン。
 */
export function PreviewPanel({
  sessionId,
  previewKey,
  hasPreview,
  projectName,
  onProjectNameChange,
  targetCloud,
  onTargetCloudChange,
  configLocked,
  status,
  deployUrl,
  isDeploying,
  onDeploy,
}: PreviewPanelProps) {
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
          className="w-40 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 outline-none transition focus:border-violet-500 disabled:opacity-60"
        />
        <select
          value={targetCloud}
          onChange={(e) => onTargetCloudChange(e.target.value as TargetCloud)}
          disabled={configLocked}
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 outline-none transition focus:border-violet-500 disabled:opacity-60"
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
          disabled={!hasPreview || isDeploying}
          className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {isDeploying ? '🚀 Deploying…' : status === 'deployed' ? '✓ Deployed' : '🚀 Deploy'}
        </button>
      </div>

      {/* デプロイ完了URL */}
      {status === 'deployed' && deployUrl && (
        <a
          href={deployUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-emerald-700/40 bg-emerald-950/40 px-4 py-2 font-mono text-xs text-emerald-300 hover:bg-emerald-950/70"
        >
          ✓ {deployUrl} ↗
        </a>
      )}

      {/* プレビュー本体 */}
      <div className="flex-1 bg-white">
        {sessionId && hasPreview ? (
          <iframe
            key={previewKey}
            src={`${API_ORIGIN}/preview/${sessionId}?k=${previewKey}`}
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

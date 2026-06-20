import type { TargetCloud } from '../types'

interface CloudOption {
  value: TargetCloud
  label: string
}

const CLOUD_OPTIONS: CloudOption[] = [
  { value: 'vercel', label: 'Vercel' },
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'Google Cloud' },
  { value: 'cloudflare', label: 'Cloudflare' },
]

interface InputPanelProps {
  projectName: string
  onProjectNameChange: (value: string) => void
  targetCloud: TargetCloud
  onTargetCloudChange: (value: TargetCloud) => void
  prompt: string
  onPromptChange: (value: string) => void
  isGenerating: boolean
  onGenerate: () => void
}

/**
 * 左カラム: プロジェクト設定 & 要件入力フォーム
 */
export function InputPanel({
  projectName,
  onProjectNameChange,
  targetCloud,
  onTargetCloudChange,
  prompt,
  onPromptChange,
  isGenerating,
  onGenerate,
}: InputPanelProps) {
  const canSubmit = projectName.trim() !== '' && prompt.trim() !== '' && !isGenerating

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-100">Project</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          作りたいアプリの要件を入力すると、AIがインフラ構築からデプロイまで自動で行います。
        </p>
      </div>

      {/* プロジェクト名 */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-400">Project Name</span>
        <input
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          disabled={isGenerating}
          placeholder="my-photo-gallery"
          className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
        />
      </label>

      {/* デプロイ先クラウド */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-400">Deploy Target</span>
        <div className="relative">
          <select
            value={targetCloud}
            onChange={(e) => onTargetCloudChange(e.target.value as TargetCloud)}
            disabled={isGenerating}
            className="w-full appearance-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 pr-9 text-sm text-neutral-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
          >
            {CLOUD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">
            ▾
          </span>
        </div>
      </label>

      {/* 要件入力 */}
      <label className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-400">Requirements</span>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={isGenerating}
          rows={8}
          placeholder="例: Reactのフォトギャラリーアプリを作って。画像アップロード機能とサムネイル一覧があり、PostgreSQLで管理したい。"
          className="min-h-40 flex-1 resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-relaxed text-neutral-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
        />
      </label>

      {/* 実行ボタン */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canSubmit}
        className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
      >
        {isGenerating ? (
          <>
            <Spinner />
            <span>Building…</span>
          </>
        ) : (
          <>
            <span aria-hidden>⚡</span>
            <span>Generate &amp; Deploy</span>
          </>
        )}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-white"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

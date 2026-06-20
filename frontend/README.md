# Infra Agent — フロントエンド

ユーザーが「作りたいアプリの要件」を入力すると、バックエンドのAIエージェント(MCPを利用したインフラ自動構築システム)が、インフラ構成ファイルの生成からクラウドへのデプロイまでを全自動で行う開発者向けツールのフロントエンドです。

技術スタック: **React + TypeScript + Vite + Tailwind CSS v4**

## セットアップ

```bash
npm install
npm run dev      # 開発サーバー起動 (http://localhost:5173)
npm run build    # 型チェック + 本番ビルド
npm run preview  # ビルド結果のプレビュー
```

開発サーバーは `/api` へのリクエストを `http://localhost:3000`(Express バックエンド)へプロキシします(設定: [vite.config.ts](./vite.config.ts))。

## ディレクトリ構成

| ファイル | 役割 |
| --- | --- |
| `src/App.tsx` | State 管理と `handleGenerate`(API通信)の集約 |
| `src/components/InputPanel.tsx` | 入力フォーム(プロジェクト名 / デプロイ先 / 要件) |
| `src/components/LogConsole.tsx` | ターミナル風のリアルタイムログ表示(自動スクロール) |
| `src/components/ResultPanel.tsx` | デプロイ完了時のURL表示 |
| `src/mockStream.ts` | バックエンド未接続でも動かすためのモックストリーム |
| `src/types.ts` | バックエンドと共有する型定義 |

## モック / 本番 の切り替え

バックエンドが未完成でもUIを確認できるよう、**モックモード**を用意しています。
切り替えは [src/App.tsx](./src/App.tsx) 冒頭の `USE_MOCK` フラグで行います。

```ts
// true  : モックストリーム(src/mockStream.ts)を使用。バックエンド不要のデモ用
// false : 本番。実際に POST /api/deploy へストリーミングリクエストする
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
```

デフォルトは**モックモード(true)**です。本番モードに切り替える方法は2通りあります。

### 方法1: 環境変数で切り替える(推奨)

プロジェクト直下に `.env`(または `.env.local`)を作成し、以下を記述します。

```env
# 本番モード(実際のバックエンドに接続)
VITE_USE_MOCK=false
```

`.env` を削除する、もしくは `VITE_USE_MOCK=true` にすればモードに戻ります。
※ Vite の環境変数を変更したら開発サーバーの再起動が必要です。

### 方法2: コードを直接書き換える

環境変数を使わない場合は、`USE_MOCK` の値を直接書き換えても切り替えられます。

```ts
const USE_MOCK = false // 本番モードに固定
```

## バックエンドのストリーミング仕様

本番モードでは `POST /api/deploy` に対し、以下のリクエストボディを送信します。

```jsonc
{
  "projectName": "my-photo-gallery",
  "targetCloud": "vercel",      // vercel | aws | gcp | cloudflare
  "prompt": "Reactのフォトギャラリーアプリを作って"
}
```

レスポンスは **NDJSON(1行 = 1つのJSON、改行区切り)** のストリームを想定しています。
フロントエンドは `response.body.getReader()` で逐次読み取り、1行ずつパースして画面に反映します。
(`data: {...}` の SSE 形式にも対応しています)

```
{"level":"thought","message":"要件を解析しています…"}
{"level":"tool","message":"MCP: filesystem.write → Dockerfile を生成"}
{"level":"success","message":"ヘルスチェック通過 (HTTP 200)"}
{"url":"https://my-photo-gallery.vercel.app"}
```

- `level`: ログの種別。`info` / `thought` / `tool` / `success` / `error` のいずれか(ターミナルの色分けに使用)
- `message`: 表示するログ本文
- `url`: このキーを含む行が**完了イベント**。受信すると結果表示エリアにデプロイURLが表示される

モックモード(`src/mockStream.ts`)も同じ形式のJSON文字列を流すため、本番接続時にフロントエンド側の変更は不要です。

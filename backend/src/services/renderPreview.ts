import { decodeUnicodeEscapes } from "./agent.js";

// デプロイ用HTMLが読み込む React / Babel(公開CDN)。
// プレビューと違い localhost には依存できないため、誰の環境でも動くCDNを使う。
const REACT_CDN = "https://unpkg.com/react@18/umd/react.production.min.js";
const REACT_DOM_CDN =
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js";
const BABEL_CDN = "https://unpkg.com/@babel/standalone@7/babel.min.js";

/**
 * decodeUnicodeEscapesで解決できなかった不正なエスケープ(桁不足の \xZZ、
 * \u12 のような不完全な \u、strictモードで無効な \1〜\9 の数値エスケープ)を
 * バックスラッシュ自体として無害化し、Babelの構文エラーを防ぐ。
 * \d, \s, \w など正規表現で使う通常のエスケープは対象外で変更しない。
 */
function sanitizeInvalidEscapes(s: string): string {
  return s
    .replace(/\\x(?![0-9a-fA-F]{2})/g, "\\\\x")
    .replace(/\\u/g, "\\\\u") // decodeUnicodeEscapesで正しい形は解決済みなので、残る \u は必ず不正
    .replace(/\\([1-9])/g, "\\\\$1");
}

/** 純粋なReactコンポーネント(.jsx)を、どの環境でも動く単一HTMLに包む(デプロイ用)。 */
export function renderPreviewHtml(jsx: string): string {
  // 古い生成物も含めて正規化:
  //  - 日本語/絵文字の \uXXXX エスケープを実際の文字へ戻す
  //  - CDNでReactをグローバル提供しているため import/export 行を除去
  const code = sanitizeInvalidEscapes(decodeUnicodeEscapes(jsx))
    .replace(/^\s*import\s.*$/gm, "")
    .replace(/^\s*export\s+default\s+.*$/gm, "")
    // <script>タグ内に埋め込むため、終了タグ文字列だけ無害化する
    .replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="${REACT_CDN}"></script>
<script src="${REACT_DOM_CDN}"></script>
<script src="${BABEL_CDN}"></script>
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif}</style>
</head>
<body>
<div id="root"></div>
<script type="text/plain" id="app-source">
const { useState, useEffect, useRef, useMemo, useCallback, useReducer } = React;
${code}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
<script>
(function () {
  var source = document.getElementById('app-source').textContent;
  try {
    // automatic JSXランタイム(import文を生成)を避け、グローバルReact/ReactDOMで動く形に変換する
    var output = Babel.transform(source, {
      presets: [["react", { runtime: "classic" }]],
    }).code;
    (0, eval)(output);
  } catch (e) {
    document.getElementById('root').innerHTML =
      '<pre style="white-space:pre-wrap;color:#dc2626;padding:16px;font-family:monospace">' +
      String(e && e.stack ? e.stack : e).replace(/</g, '&lt;') +
      '</pre>';
  }
})();
</script>
</body>
</html>`;
}

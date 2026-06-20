import { decodeUnicodeEscapes } from "./agent.js";

/** 純粋なReactコンポーネント(.jsx)を、Babelで動く単一HTMLに包む。
 *  vendorScriptBase で React/Babel の配信元(オリジン)を指定する。 */
export function renderPreviewHtml(jsx: string, vendorScriptBase = ""): string {
  // 古い生成物も含めて正規化:
  //  - 日本語/絵文字の \uXXXX エスケープを実際の文字へ戻す
  //  - CDNでReactをグローバル提供しているため import/export 行を除去
  const code = decodeUnicodeEscapes(jsx)
    .replace(/^\s*import\s.*$/gm, "")
    .replace(/^\s*export\s+default\s+.*$/gm, "")
    // <script>タグ内に埋め込むため、終了タグ文字列だけ無害化する
    .replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="${vendorScriptBase}/vendor/react.development.js"></script>
<script src="${vendorScriptBase}/vendor/react-dom.development.js"></script>
<script src="${vendorScriptBase}/vendor/babel.min.js"></script>
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

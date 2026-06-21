// 生成された .jsx を、ブラウザの iframe(srcDoc) で動く単一HTMLに包む。
// React / ReactDOM / Babel はバックエンドが配信する /vendor を使う。

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3000'

/** モデルが日本語・絵文字を \uXXXX / \u{XXXXX} でエスケープして返すことがあるため戻す */
function decodeUnicodeEscapes(s: string): string {
  return s
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
}

export function renderPreviewHtml(jsx: string): string {
  const code = decodeUnicodeEscapes(jsx)
    .replace(/^\s*import\s.*$/gm, '')
    .replace(/^\s*export\s+default\s+.*$/gm, '')
    // <script>タグ内に埋め込むため、終了タグ文字列だけ無害化する
    .replace(/<\/script/gi, '<\\/script')

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="${API_ORIGIN}/vendor/react.development.js"></script>
<script src="${API_ORIGIN}/vendor/react-dom.development.js"></script>
<script src="${API_ORIGIN}/vendor/babel.min.js"></script>
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
</html>`
}

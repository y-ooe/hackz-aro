import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as cheerio from "cheerio";
import { z } from "zod";

const BASE_URL = "https://topaz.dev";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; HackzAro-MCP/1.0)",
  "Accept-Language": "ja,en;q=0.9",
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function extractArticles(
  $: cheerio.CheerioAPI,
  type: "projects" | "recipes"
): { title: string; url: string; tags: string[] }[] {
  const results: { title: string; url: string; tags: string[] }[] = [];
  const seen = new Set<string>();

  $(`a[href^="/${type}/"]`).each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (seen.has(href)) return;
    seen.add(href);

    // カード全体のテキストからタイトルとタグを取り出す
    const cardEl = $(el).closest("li, article, div").length
      ? $(el).closest("li, article, div")
      : $(el);

    const fullText = cardEl.text().replace(/\s+/g, " ").trim();
    // 先頭行をタイトルとして扱う
    const lines = fullText.split(/\n|。/).map((l) => l.trim()).filter(Boolean);
    const title = lines[0] ?? fullText.slice(0, 60);

    // タグ: /projects?tags=xxx or /recipes?tags=xxx 形式のリンクテキスト
    const tags: string[] = [];
    cardEl.find(`a[href*="?tags="]`).each((_, tagEl) => {
      const t = $(tagEl).text().trim();
      if (t) tags.push(t);
    });

    if (title && href) {
      results.push({
        title,
        url: `${BASE_URL}${href}`,
        tags,
      });
    }
  });

  return results;
}

const server = new McpServer({
  name: "hackz-aro-topaz",
  version: "1.0.0",
});

// ツール1: トレンド記事一覧（「何でもいいから作って」用）
server.tool(
  "get_trending_ideas",
  "topaz.devの最新プロジェクト・レシピからアイデアと使用技術を取得します。ユーザーが「何でもいいから作って」と言った時に使います。",
  {
    type: z
      .enum(["projects", "recipes", "both"])
      .default("both")
      .describe("取得するコンテンツ種別"),
  },
  async ({ type }) => {
    const targets =
      type === "both"
        ? (["projects", "recipes"] as const)
        : ([type] as const);

    const allArticles: string[] = [];

    for (const t of targets) {
      const html = await fetchHtml(`${BASE_URL}/${t}`);
      const $ = cheerio.load(html);
      const articles = extractArticles($, t);

      const section = t === "projects" ? "プロジェクト" : "レシピ";
      allArticles.push(
        `## ${section}\n` +
          articles
            .slice(0, 8)
            .map(
              (a, i) =>
                `${i + 1}. ${a.title}\n   タグ: ${a.tags.join(", ") || "なし"}\n   URL: ${a.url}`
            )
            .join("\n\n")
      );
    }

    return {
      content: [
        {
          type: "text",
          text: `# topaz.dev 最新コンテンツ\n\n${allArticles.join("\n\n")}`,
        },
      ],
    };
  }
);

// ツール2: 技術タグで絞り込み検索
server.tool(
  "search_by_technology",
  "topaz.devで指定した技術タグのプロジェクト・レシピを検索します。ユーザーが特定の技術でコーディングを依頼した時に使います。",
  {
    tag: z
      .string()
      .describe("検索する技術名（例: TypeScript, React, Python, Next.js）"),
    type: z
      .enum(["projects", "recipes", "both"])
      .default("both")
      .describe("検索対象"),
  },
  async ({ tag, type }) => {
    const targets =
      type === "both"
        ? (["projects", "recipes"] as const)
        : ([type] as const);

    const allResults: string[] = [];

    for (const t of targets) {
      const url = `${BASE_URL}/${t}?tags=${encodeURIComponent(tag)}`;
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const articles = extractArticles($, t);

      if (articles.length === 0) continue;

      const section = t === "projects" ? "プロジェクト" : "レシピ";
      allResults.push(
        `## ${section}\n` +
          articles
            .slice(0, 6)
            .map(
              (a, i) =>
                `${i + 1}. ${a.title}\n   タグ: ${a.tags.join(", ") || "なし"}\n   URL: ${a.url}`
            )
            .join("\n\n")
      );
    }

    if (allResults.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `「${tag}」の記事が見つかりませんでした。タグ名（英語・大文字小文字）を確認してください。`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `# topaz.dev「${tag}」の検索結果\n\n${allResults.join("\n\n")}`,
        },
      ],
    };
  }
);

// ツール3: 記事本文取得
server.tool(
  "get_article_content",
  "topaz.devのプロジェクト・レシピURLを指定して本文を取得します。実装の詳細やコードを参照する時に使います。",
  {
    url: z.string().url().describe("取得するtopaz.devの記事URL"),
  },
  async ({ url }) => {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    $("script, style, nav, footer, header").remove();

    // メインコンテンツを取得（main > article > div の順で試みる）
    const content =
      $("main").text() ||
      $("article").text() ||
      $("body").text();

    const cleaned = content.replace(/\s+/g, " ").trim();

    return {
      content: [
        {
          type: "text",
          text: cleaned.slice(0, 8000),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
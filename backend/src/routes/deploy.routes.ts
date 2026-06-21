import { Router } from "express";

import { deployApp } from "../services/deploy/deployApp.js";
import { deployAppEc2 } from "../services/deploy/deployAppEc2.js";
import {
  deployStaticSite,
  makeBucketName,
} from "../services/deploy/deployStaticSite.js";
import { deployHtml } from "../services/deploy/deployHtml.js";

export const deployRoutes = Router();

/** 生成アプリ(.jsx)を単一HTMLにして S3 にデプロイする。 */
deployRoutes.post("/api/deploy-app", async (request, response) => {
  const { projectName, jsx } = request.body ?? {};

  if (typeof jsx !== "string" || !jsx.trim()) {
    response.status(400).json({ error: "デプロイ対象のアプリがありません" });
    return;
  }

  const name =
    typeof projectName === "string" && projectName.trim()
      ? projectName.trim()
      : "my-app";

  try {
    const result = await deployApp(name, jsx);
    response.status(200).json(result);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "デプロイに失敗しました";
    response.status(500).json({ error: message });
  }
});

/** 生成アプリ(.jsx)を単一HTMLにして EC2(nginx) にデプロイする。 */
deployRoutes.post("/api/deploy-app-ec2", async (request, response) => {
  const { projectName, jsx } = request.body ?? {};

  if (typeof jsx !== "string" || !jsx.trim()) {
    response.status(400).json({ error: "デプロイ対象のアプリがありません" });
    return;
  }

  const name =
    typeof projectName === "string" && projectName.trim()
      ? projectName.trim()
      : "my-app";

  try {
    const result = await deployAppEc2(name, jsx);
    response.status(200).json(result);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "デプロイに失敗しました";
    response.status(500).json({ error: message });
  }
});

/** react-scripts 等でビルドした静的サイトを S3 にデプロイする。 */
deployRoutes.post("/deploy", async (req, res) => {
  const { projectDir, appName } = req.body as {
    projectDir?: string;
    appName?: string;
  };

  if (!projectDir) {
    return res.status(400).json({ error: "projectDir は必須です" });
  }

  try {
    const result = await deployStaticSite({
      projectDir,
      bucketName: makeBucketName(appName ?? "app"),
      // region は env (AWS_REGION) で指定。未指定なら東京(ap-northeast-1)
    });
    // result.url をフロントに返せば、そのままアクセスできる
    res.json(result);
  } catch (err) {
    console.error("[deploy] 失敗:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "デプロイに失敗しました",
    });
  }
});

/** 単一HTMLファイルを S3 にデプロイする。 */
deployRoutes.post("/deploy-html", async (req, res) => {
  const { html, htmlPath, appName } = req.body as {
    html?: string;
    htmlPath?: string;
    appName?: string;
  };

  if (!html && !htmlPath) {
    return res
      .status(400)
      .json({ error: "html か htmlPath のどちらかが必要です" });
  }

  try {
    const result = await deployHtml({
      ...(html !== undefined && { html }),
      ...(htmlPath !== undefined && { htmlPath }),
      bucketName: makeBucketName(appName ?? "app"),
    });
    res.json(result);
  } catch (err) {
    console.error("[deploy-html] 失敗:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "デプロイに失敗しました",
    });
  }
});

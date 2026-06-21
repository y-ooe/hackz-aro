import { renderPreviewHtml } from "../renderPreview.js";
import { deployEc2 } from "./deployEc2.js";
import { drawInstanceGacha, type Rarity } from "./instanceGacha.js";

export interface DeployResult {
  url: string;
  /** ガチャで引いたインスタンスタイプ(例: t3.small) */
  instanceType: string;
  /** レアリティ種別 */
  rarity: Rarity;
  /** 表示用ラベル(例: レア) */
  rarityLabel: string;
  /** 演出用の絵文字 */
  emoji: string;
}

/**
 * 生成したアプリ(.jsx)を EC2 にデプロイする。
 *
 * 1. JSX を、CDN参照の単一HTML(どの環境でも動く)に包む
 * 2. 「運」要素: ガチャでサーバーの大きさ(インスタンスタイプ)を抽選する
 * 3. deployEc2() で nginx を載せた EC2 インスタンスを起動し index.html として配信
 * 4. 公開URLと抽選結果を返す
 *
 * S3版(deployApp) と同じ呼び出し方で、配信先だけ EC2 に差し替えたもの。
 * AWS認証情報・リージョンは環境変数(.env)を使う。
 */
export async function deployAppEc2(
  projectName: string,
  jsx: string
): Promise<DeployResult> {
  if (!jsx) {
    throw new Error("デプロイ対象のアプリがまだ生成されていません");
  }

  // 1. デプロイ可能な単一HTMLを生成
  const html = renderPreviewHtml(jsx);

  // 2. 「運」: サーバーの大きさをガチャで決める
  const gacha = drawInstanceGacha();
  console.log(
    `Instance gacha: ${gacha.emoji} ${gacha.rarityLabel} → ${gacha.instanceType}`
  );

  // 3. EC2 に起動・配信（Nameタグにプロジェクト名、抽選したタイプを使う）
  const result = await deployEc2({
    html,
    name: projectName,
    instanceType: gacha.instanceType,
  });

  // 4. 公開URLと抽選結果を返す
  return {
    url: result.url,
    instanceType: gacha.instanceType,
    rarity: gacha.rarity,
    rarityLabel: gacha.rarityLabel,
    emoji: gacha.emoji,
  };
}

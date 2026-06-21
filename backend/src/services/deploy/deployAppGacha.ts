import { deployApp } from "./deployApp.js";
import { deployAppEc2 } from "./deployAppEc2.js";
import { drawDeployTarget, type DeployTarget } from "./deployTargetGacha.js";
import type { Rarity } from "./instanceGacha.js";

/** EC2 を引いたときだけ付く、サーバー大きさガチャの結果 */
export interface SizeGacha {
  instanceType: string;
  rarity: Rarity;
  rarityLabel: string;
  emoji: string;
}

export interface DeployGachaResult {
  url: string;
  /** 引いたデプロイ先 */
  target: DeployTarget;
  /** 表示用ラベル(例: EC2) */
  targetLabel: string;
  /** 演出用の絵文字 */
  targetEmoji: string;
  /** EC2 のときのみ: サーバー大きさガチャ結果。S3 のときは null */
  size: SizeGacha | null;
}

/**
 * 生成したアプリ(.jsx)を「ガチャ」でデプロイする。
 *
 * 1. デプロイ先(S3 / EC2)を抽選
 * 2. S3 を引いたら deployApp() で即デプロイ
 * 3. EC2 を引いたら deployAppEc2() でデプロイ(その中でさらにサーバー大きさを抽選)
 * 4. 引いた結果と公開URLを返す
 */
export async function deployAppGacha(
  projectName: string,
  jsx: string
): Promise<DeployGachaResult> {
  if (!jsx) {
    throw new Error("デプロイ対象のアプリがまだ生成されていません");
  }

  // 1. デプロイ先を抽選
  const target = drawDeployTarget();
  console.log(`Deploy target gacha: ${target.emoji} ${target.label}`);

  // 2. S3 を引いた場合: 即デプロイ(サーバー大きさガチャは無し)
  if (target.target === "s3") {
    const result = await deployApp(projectName, jsx);
    return {
      url: result.url,
      target: target.target,
      targetLabel: target.label,
      targetEmoji: target.emoji,
      size: null,
    };
  }

  // 3. EC2 を引いた場合: deployAppEc2 内でサーバー大きさも抽選される
  const result = await deployAppEc2(projectName, jsx);
  return {
    url: result.url,
    target: target.target,
    targetLabel: target.label,
    targetEmoji: target.emoji,
    size: {
      instanceType: result.instanceType,
      rarity: result.rarity,
      rarityLabel: result.rarityLabel,
      emoji: result.emoji,
    },
  };
}

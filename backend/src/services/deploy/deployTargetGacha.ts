// デプロイ先の「ガチャ」抽選。
// お題が「運」なので、デプロイのたびに配信先(S3 / EC2)もランダムに引く。

export type DeployTarget = "ec2" | "s3";

export interface DeployTargetEntry {
  target: DeployTarget;
  label: string;
  emoji: string;
  /** 抽選の重み(相対値)。合計に対する割合で当たる。 */
  weight: number;
}

export interface DeployTargetResult {
  target: DeployTarget;
  label: string;
  emoji: string;
}

/**
 * 抽選プール。weight を変えれば確率を調整できる。
 * 既定: EC2 60% / S3 40%
 */
const TARGET_POOL: DeployTargetEntry[] = [
  { target: "ec2", label: "EC2", emoji: "🖥️", weight: 60 },
  { target: "s3", label: "S3", emoji: "🪣", weight: 40 },
];

/** 重み付きランダムでデプロイ先を1つ引く。 */
export function drawDeployTarget(): DeployTargetResult {
  const total = TARGET_POOL.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;

  for (const entry of TARGET_POOL) {
    roll -= entry.weight;
    if (roll < 0) {
      return { target: entry.target, label: entry.label, emoji: entry.emoji };
    }
  }

  // 浮動小数の誤差で抜けた場合は末尾を返す(理論上ほぼ起きない)
  const last = TARGET_POOL[TARGET_POOL.length - 1]!;
  return { target: last.target, label: last.label, emoji: last.emoji };
}

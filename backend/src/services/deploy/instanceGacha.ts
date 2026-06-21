// EC2 インスタンスタイプの「ガチャ」抽選。
// お題が「運」なので、デプロイのたびにサーバーの大きさをランダムに引く。
// コスト暴発を避けるため、プールは安いタイプ(micro〜medium)に限定している。

export type Rarity = "common" | "rare" | "ssr";

export interface GachaEntry {
  instanceType: string;
  rarity: Rarity;
  /** 抽選の重み(相対値)。合計に対する割合で当たる。 */
  weight: number;
}

export interface GachaResult {
  instanceType: string;
  rarity: Rarity;
  /** 表示用ラベル(日本語) */
  rarityLabel: string;
  /** 演出用の絵文字 */
  emoji: string;
}

/**
 * 抽選プール。weight を変えれば確率を調整できる。
 * 既定: コモン70% / レア25% / SSR5%
 */
const GACHA_POOL: GachaEntry[] = [
  { instanceType: "t3.micro", rarity: "common", weight: 70 },
  { instanceType: "t3.small", rarity: "rare", weight: 25 },
  { instanceType: "t3.medium", rarity: "ssr", weight: 5 },
];

const RARITY_META: Record<Rarity, { label: string; emoji: string }> = {
  common: { label: "コモン", emoji: "⚪" },
  rare: { label: "レア", emoji: "🔵" },
  ssr: { label: "激レア(SSR)", emoji: "🌟" },
};

/** 重み付きランダムで1つ引く。 */
export function drawInstanceGacha(): GachaResult {
  const total = GACHA_POOL.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;

  for (const entry of GACHA_POOL) {
    roll -= entry.weight;
    if (roll < 0) {
      const meta = RARITY_META[entry.rarity];
      return {
        instanceType: entry.instanceType,
        rarity: entry.rarity,
        rarityLabel: meta.label,
        emoji: meta.emoji,
      };
    }
  }

  // 浮動小数の誤差で抜けた場合は末尾を返す(理論上ほぼ起きない)
  const last = GACHA_POOL[GACHA_POOL.length - 1]!;
  const meta = RARITY_META[last.rarity];
  return {
    instanceType: last.instanceType,
    rarity: last.rarity,
    rarityLabel: meta.label,
    emoji: meta.emoji,
  };
}

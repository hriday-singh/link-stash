/** Why a card is worth keeping. Mirrors `Bucket` in apps/core store/models.py. */
export const BUCKETS = ["try-now", "later", "upgrade", "inspiration"] as const;

export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABELS: Record<Bucket, string> = {
  "try-now": "Try now",
  later: "Later",
  upgrade: "Upgrade",
  inspiration: "Inspiration",
};

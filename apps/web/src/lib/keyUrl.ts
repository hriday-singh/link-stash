const HF_PREFIX: Record<string, string> = { model: "", dataset: "datasets/", space: "spaces/" };

/** Link to paste back into `/stash` for a reject key, or null when the key shape is unknown. */
export function keyToUrl(key: string): string | null {
  const [kind, ...rest] = key.split(":");
  const body = rest.join(":");
  if (!body) return null;
  if (kind === "github") return `https://github.com/${body}`;
  if (kind === "ig") return `https://www.instagram.com/p/${body}/`;
  if (kind === "url") return /^https?:\/\//.test(body) ? body : `https://${body}`;
  if (kind === "hf") {
    const [type, ...name] = rest;
    const prefix = type === undefined ? undefined : HF_PREFIX[type];
    return prefix === undefined || name.length === 0
      ? null
      : `https://huggingface.co/${prefix}${name.join(":")}`;
  }
  return null;
}

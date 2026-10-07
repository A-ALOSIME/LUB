const DESCRIPTION_LIMIT = 160;

export function toMetaDescription(value: string, fallback: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  if (clean.length <= DESCRIPTION_LIMIT) return clean;

  const excerpt = clean.slice(0, DESCRIPTION_LIMIT - 1);
  const lastSpace = excerpt.lastIndexOf(" ");
  return `${(lastSpace >= DESCRIPTION_LIMIT * 0.7 ? excerpt.slice(0, lastSpace) : excerpt).trimEnd()}…`;
}

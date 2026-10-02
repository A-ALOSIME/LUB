import { createHash } from "node:crypto";

export function migrationHashMatches(source: string, expected: string) {
  const lf = source.replace(/\r\n?/g, "\n");
  return [source, lf, lf.replace(/\n/g, "\r\n")].some((candidate) => createHash("sha256").update(candidate).digest("hex") === expected);
}

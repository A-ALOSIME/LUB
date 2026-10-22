/** Groups siblings into stable rows; CSS chooses how many columns fit at each viewport width. */
export function chunkCommitteeChartNodes<T>(nodes: readonly T[], maxPerRow = 4): T[][] {
  const safeMaxPerRow = Math.max(1, Math.floor(maxPerRow));
  const rows: T[][] = [];

  for (let index = 0; index < nodes.length; index += safeMaxPerRow) {
    rows.push(nodes.slice(index, index + safeMaxPerRow));
  }

  return rows;
}

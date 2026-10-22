import { expect, it } from "vitest";
import { chunkCommitteeChartNodes } from "./committee-chart-layout";

it("groups large sibling sets into balanced rows of at most four", () => {
  const nodes = Array.from({ length: 12 }, (_, index) => `committee-${index + 1}`);

  expect(chunkCommitteeChartNodes(nodes)).toEqual([
    ["committee-1", "committee-2", "committee-3", "committee-4"],
    ["committee-5", "committee-6", "committee-7", "committee-8"],
    ["committee-9", "committee-10", "committee-11", "committee-12"],
  ]);
});

it("keeps a short sibling set in a single row", () => {
  expect(chunkCommitteeChartNodes(["committee-a", "committee-b", "committee-c"])).toEqual([
    ["committee-a", "committee-b", "committee-c"],
  ]);
});

it("supports a one-column row limit without dropping nodes", () => {
  expect(chunkCommitteeChartNodes(["committee-a", "committee-b"], 1)).toEqual([
    ["committee-a"],
    ["committee-b"],
  ]);
});

import { expect, it } from "vitest";
import { previewApplications } from "./application-preview";
import { countApplicationStatuses, matchesApplicationStatus } from "./application-status";

it("groups submitted and interview requests under review and counts final states", () => {
  expect(countApplicationStatuses(previewApplications)).toEqual({
    all: 5,
    review: 2,
    accepted: 1,
    rejected: 1,
    withdrawn: 1,
  });
  expect(matchesApplicationStatus("Interview", "review")).toBe(true);
});

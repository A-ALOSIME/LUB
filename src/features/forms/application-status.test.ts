import { expect, it } from "vitest";
import { previewApplications } from "./application-preview";
import { countApplicationStatuses, matchesApplicationStatus } from "./application-status";

it("counts interview requests separately from submitted requests and final states", () => {
  expect(countApplicationStatuses(previewApplications)).toEqual({
    all: 5,
    review: 1,interview:1,
    accepted: 1,
    rejected: 1,
    withdrawn: 1,
  });
  expect(matchesApplicationStatus("Interview", "review")).toBe(false);
});

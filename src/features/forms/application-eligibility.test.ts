import { describe, expect, it } from "vitest";
import { canReapplyToApplication, canWithdrawApplication } from "./application-eligibility";

describe("student application actions", () => {
  it("allows withdrawal only for an active application in an open, withdrawable round", () => {
    expect(canWithdrawApplication({ status_code: "Submitted", round_open: true, allow_withdrawal: true })).toBe(true);
    expect(canWithdrawApplication({ status_code: "Interview", round_open: true, allow_withdrawal: true })).toBe(true);
    expect(canWithdrawApplication({ status_code: "Submitted", round_open: false, allow_withdrawal: true })).toBe(false);
    expect(canWithdrawApplication({ status_code: "Submitted", round_open: true, allow_withdrawal: false })).toBe(false);
    expect(canWithdrawApplication({ status_code: "Accepted", round_open: true, allow_withdrawal: true })).toBe(false);
  });

  it("allows a new application after withdrawal only while its round is open", () => {
    expect(canReapplyToApplication({ status_code: "Withdrawn", round_open: true, has_active_application: false, has_newer_application: false })).toBe(true);
    expect(canReapplyToApplication({ status_code: "Withdrawn", round_open: false, has_active_application: false, has_newer_application: false })).toBe(false);
    expect(canReapplyToApplication({ status_code: "Withdrawn", round_open: true, has_active_application: true, has_newer_application: false })).toBe(false);
    expect(canReapplyToApplication({ status_code: "Withdrawn", round_open: true, has_active_application: false, has_newer_application: true })).toBe(false);
    expect(canReapplyToApplication({ status_code: "Submitted", round_open: true, has_active_application: false, has_newer_application: false })).toBe(false);
    expect(canReapplyToApplication({ status_code: "Rejected", round_open: true, has_active_application: false, has_newer_application: false })).toBe(false);
  });
});

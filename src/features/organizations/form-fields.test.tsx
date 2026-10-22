// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CommitteeFields } from "./form-fields";

afterEach(cleanup);

it("presents public committee visibility as a concise switch", () => {
  render(<form><CommitteeFields prefix="committee" locale="ar" value={{ name: "لجنة", description: "", isPublic: true }} /></form>);

  expect(screen.getByRole("switch", { name: "إظهار اللجنة للعامة" })).toBeTruthy();
  expect(screen.queryByText("تظهر اللجنة في صفحة الجهة العامة.")).toBeNull();
  expect(document.querySelector(".committee-visibility-card")).toBeNull();
});

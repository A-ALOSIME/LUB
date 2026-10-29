// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnimatedStat } from "./animated-stat";

afterEach(cleanup);

describe("animated organization statistics", () => {
  it("keeps the complete value available as text and an accessible name", () => {
    render(<AnimatedStat value="3,216+" />);

    expect(screen.getByLabelText("٣,٢١٦+")).toBeTruthy();
    expect(screen.getByText("٣,٢١٦+")).toBeTruthy();
  });
});

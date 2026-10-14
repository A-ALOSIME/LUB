// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ContactVisibilityButton } from "./contact-visibility-button";

afterEach(cleanup);

it("toggles channel visibility from the eye button and updates the submitted value", () => {
  const { container } = render(<form>
    <ContactVisibilityButton name="link_visible" label="LinkedIn" visible={true} locale="en" />
  </form>);

  const button = screen.getByRole("button", { name: "Hide LinkedIn from the public profile" });
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelector<HTMLInputElement>('input[name="link_visible"]')?.value).toBe("true");

  fireEvent.click(button);

  expect(screen.getByRole("button", { name: "Show LinkedIn on the public profile" }).getAttribute("aria-pressed")).toBe("false");
  expect(container.querySelector<HTMLInputElement>('input[name="link_visible"]')?.value).toBe("false");
  expect(container.querySelector("svg.lucide-eye-off")).toBeTruthy();
});

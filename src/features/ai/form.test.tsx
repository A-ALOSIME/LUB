// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const search = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ searchKnowledge: search }));

import { KnowledgeSearch } from "./form";
import { publicKnowledge } from "./knowledge";

afterEach(() => { cleanup(); search.mockReset(); });

it("keeps the single-question composer readable in English", () => {
  render(<KnowledgeSearch locale="en" />);
  expect(screen.getByRole("textbox", { name: "Your question" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send question" })).toBeTruthy();
});

it("keeps the question and focuses a service error", async () => {
  search.mockResolvedValue({ sources: null, error: "البحث غير متاح" });
  render(<KnowledgeSearch />);
  fireEvent.change(screen.getByRole("textbox", { name: "سؤالك" }), { target: { value: "كيف أسجل نادي؟" } });
  fireEvent.submit(screen.getByRole("button", { name: "إرسال السؤال" }).closest("form")!);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));
  expect((screen.getByRole("textbox", { name: "سؤالك" }) as HTMLTextAreaElement).value).toBe("كيف أسجل نادي؟");
  expect(screen.queryByRole("heading", { name: "مقاطع ذات صلة" })).toBeNull();
});

it("shows public source text as a result and copies it", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  search.mockResolvedValueOnce({ sources: [publicKnowledge[1]] }).mockResolvedValueOnce({ sources: [] });
  render(<KnowledgeSearch />);
  const form = screen.getByRole("button", { name: "إرسال السؤال" }).closest("form")!;
  fireEvent.change(screen.getByRole("textbox", { name: "سؤالك" }), { target: { value: "تسجيل نادي" } });
  fireEvent.submit(form);
  await waitFor(() => expect(screen.getByRole("link", { name: publicKnowledge[1].title }).getAttribute("href")).toBe("/help/membership"));
  expect(screen.getByRole("heading", { name: "مقاطع ذات صلة" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "نسخ النتيجة" }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining(publicKnowledge[1].text)));
  expect(screen.getByRole("status").textContent).toContain("نُسخت");
  fireEvent.submit(form);
  await waitFor(() => expect(screen.getByText(/ما لقيت مرجعًا مناسبًا/)).toBeTruthy());
});

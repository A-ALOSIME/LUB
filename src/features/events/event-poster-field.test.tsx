// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EventPosterField } from "./event-poster-field";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("uploads a selected JPEG/PNG poster with its organization and shows the preview", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "asset-1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:poster") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

  render(<EventPosterField organization="org-1" locale="ar" />);
  const file = new File([new Uint8Array([137, 80, 78, 71])], "poster.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("صورة بوستر الفعالية"), { target: { files: [file] } });

  await waitFor(() => expect(screen.getByText(/تم رفع البوستر/)).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledWith("/files/upload?purpose=event-poster", expect.objectContaining({ method: "POST" }));
  const body = fetchMock.mock.calls[0][1].body as FormData;
  expect(body.get("file")).toBe(file);
  expect(body.get("organization")).toBe("org-1");
});

it("shows the safe reason returned by the upload API", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "organization_permission_required" }), { status: 403 })));
  render(<EventPosterField organization="org-1" locale="ar" />);
  fireEvent.change(screen.getByLabelText("صورة بوستر الفعالية"), {
    target: { files: [new File([new Uint8Array([1])], "poster.png", { type: "image/png" })] },
  });

  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("لا تملك صلاحية رفع بوستر لهذه الجهة."));
});

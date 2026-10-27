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

  await waitFor(() => expect(screen.getByAltText("معاينة بوستر الفعالية").getAttribute("src")).toBe("/files/asset-1/preview"));
  expect(screen.getByRole("button",{name:"تغيير"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"حذف"}));
  expect(document.querySelector<HTMLInputElement>('input[name="poster"]')?.value).toBe("");
  expect(screen.queryByAltText("معاينة بوستر الفعالية")).toBeNull();
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

it("retries the same failed file without resetting the surrounding form", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: "storage_unavailable" }), { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "retry-asset" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:retry") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  render(<form><input aria-label="عنوان الفعالية" defaultValue="فعالية تجريبية" /><EventPosterField organization="org-1" locale="ar" /></form>);
  const file = new File([new Uint8Array([137, 80, 78, 71])], "poster.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("صورة بوستر الفعالية"), { target: { files: [file] } });
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
  await screen.findByAltText("معاينة بوستر الفعالية");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect((fetchMock.mock.calls[1][1].body as FormData).get("file")).toBe(file);
  expect((screen.getByLabelText("عنوان الفعالية") as HTMLInputElement).value).toBe("فعالية تجريبية");
});

it("distinguishes oversized images from unsupported formats before upload", () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<EventPosterField organization="org-1" locale="ar" />);
  const input = screen.getByLabelText("صورة بوستر الفعالية");
  fireEvent.change(input, { target: { files: [new File(["gif"], "poster.gif", { type: "image/gif" })] } });
  expect(screen.getByRole("alert").textContent).toBe("استخدم صورة JPEG أو PNG.");
  fireEvent.change(input, { target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "poster.png", { type: "image/png" })] } });
  expect(screen.getByRole("alert").textContent).toBe("حجم الصورة أكبر من 5 ميجابايت.");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows the local poster immediately while upload is still pending",async()=>{vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(()=> 'blob:immediate')});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});render(<EventPosterField organization="org-1" locale="ar"/>);fireEvent.change(screen.getByLabelText('صورة بوستر الفعالية'),{target:{files:[new File(['image'],'poster.png',{type:'image/png'})]}});expect(screen.getByAltText('معاينة بوستر الفعالية').getAttribute('src')).toBe('blob:immediate');expect(screen.getByRole('status').textContent).toContain('جارٍ');});

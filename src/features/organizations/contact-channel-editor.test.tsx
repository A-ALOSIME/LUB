// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationContactChannelEditor } from "./contact-channel-editor";

afterEach(cleanup);

describe("organization contact channel editor", () => {
  it("keeps the add action beside its section heading", () => {
    const { container } = render(<OrganizationContactChannelEditor initialChannels={[]} locale="ar" />);
    const heading = screen.getByRole("heading", { name: "قنوات التواصل" });
    const addButton = screen.getByRole("button", { name: "إضافة قناة" });

    expect(container.querySelector(".organization-contact-editor")?.getAttribute("dir")).toBe("rtl");
    expect(heading.parentElement).toBe(addButton.parentElement);
    expect(heading.parentElement?.classList.contains("organization-contact-heading")).toBe(true);
  });

  it("shows a small field-specific validation error after an invalid value is blurred", () => {
    render(<OrganizationContactChannelEditor initialChannels={[{ kind: "Email", value: "team@example.edu" }]} locale="ar" />);
    const email = screen.getByRole("textbox", { name: "البريد القيمة" });

    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.blur(email);

    expect(screen.getByRole("alert").textContent).toContain("بريد");
  });

  it("asks before deleting a channel and only removes it after confirmation", async () => {
    const { container } = render(<OrganizationContactChannelEditor initialChannels={[{ kind: "Email", value: "team@example.edu" }]} locale="ar" />);
    fireEvent.click(screen.getByRole("button", { name: "حذف البريد" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("حذف قناة التواصل");
    expect(container.querySelector(".organization-contact-field-wrap .organization-contact-delete")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "حذف القناة" }));

    await waitFor(() => expect(document.querySelector<HTMLInputElement>('input[name="contacts"]')?.value).toBe("[]"));
  });

  it("opens a channel-type menu and adds a valid channel", async () => {
    render(<OrganizationContactChannelEditor initialChannels={[]} locale="ar" />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة قناة" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "LinkedIn" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "LinkedIn" }), { target: { value: "https://linkedin.com/company/lub" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "إضافة القناة" }));

    await waitFor(() => expect(document.querySelector<HTMLInputElement>('input[name="contacts"]')?.value).toBe(JSON.stringify([{ kind: "LinkedIn", value: "https://linkedin.com/company/lub" }])));
  });

  it("shows an inline error when a new channel does not match its type", async () => {
    render(<OrganizationContactChannelEditor initialChannels={[]} locale="ar" />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة قناة" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "البريد" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "البريد" }), { target: { value: "invalid-email" } });
    fireEvent.submit(dialog.querySelector("form")!);

    expect((await within(dialog).findByRole("alert")).textContent).toContain("بريداً إلكترونياً صحيحاً");
  });

  it("offers GitHub and serializes its link for the shared profile save", async () => {
    render(<OrganizationContactChannelEditor initialChannels={[]} locale="ar" />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة قناة" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "GitHub" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "GitHub" }), { target: { value: "https://github.com/lub" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "إضافة القناة" }));
    await waitFor(() => expect(document.querySelector<HTMLInputElement>('input[name="contacts"]')?.value).toBe(JSON.stringify([{ kind: "GitHub", value: "https://github.com/lub" }])));
    expect(screen.getByRole("textbox", { name: "GitHub القيمة" }).getAttribute("dir")).toBe("ltr");
  });
});

import { expect, it } from "vitest";
import { contactChannelFromProfileLink, normalizeOrganizationContact, organizationContactAddableKinds, profileLinksToContactChannels, storedLinksToContactChannels } from "./contact-channels";

it("normalizes supported public contact channels to safe, explicit URLs", () => {
  expect(normalizeOrganizationContact({ kind: "Email", value: " council@example.edu " })).toEqual({
    kind: "Email", value: "council@example.edu", url: "mailto:council@example.edu",
  });
  expect(normalizeOrganizationContact({ kind: "Phone", value: "+966 50 123 4567" })).toEqual({
    kind: "Phone", value: "+966501234567", url: "tel:+966501234567",
  });
  expect(normalizeOrganizationContact({ kind: "LinkedIn", value: "https://linkedin.com/company/example" })).toEqual({
    kind: "LinkedIn", value: "https://linkedin.com/company/example", url: "https://linkedin.com/company/example",
  });
});

it("accepts every channel offered by organization profiles", () => {
  const values: Record<(typeof organizationContactAddableKinds)[number], string> = {
    Email: "team@example.edu",
    Phone: "+966 50 123 4567",
    Website: "https://example.edu",
    LinkedIn: "https://linkedin.com/company/example",
    X: "https://x.com/example",
    TikTok: "https://tiktok.com/@example",
    Instagram: "https://instagram.com/example",
  };

  for (const kind of organizationContactAddableKinds) {
    expect(normalizeOrganizationContact({ kind, value: values[kind] })?.kind).toBe(kind);
  }
});

it("rejects unsafe, malformed, or credential-bearing organization links", () => {
  for (const channel of [
    { kind: "Website", value: "javascript:alert(1)" },
    { kind: "X", value: "http://x.com/example" },
    { kind: "GitHub", value: "https://user:password@github.com/example" },
    { kind: "Email", value: "not-an-email" },
    { kind: "Phone", value: "+966 50<script>" },
  ]) expect(normalizeOrganizationContact(channel)).toBeNull();
});

it("converts curated profile links into editable channels", () => {
  expect(contactChannelFromProfileLink({ label: "البريد الإلكتروني", value: "team@example.edu", href: "mailto:team@example.edu" }))
    .toEqual({ kind: "Email", value: "team@example.edu" });
  expect(contactChannelFromProfileLink({ label: "X", value: "@lub", href: "https://x.com/lub" }))
    .toEqual({ kind: "X", value: "https://x.com/lub" });
});

it("maps profile and stored links in the server-safe contact data module", () => {
  expect(profileLinksToContactChannels([
    { label: "GitHub", value: "lub", href: "https://github.com/lub" },
    { label: "No link", value: "hidden" },
  ])).toEqual([{ kind: "GitHub", value: "https://github.com/lub" }]);
  expect(profileLinksToContactChannels(undefined)).toEqual([]);
  expect(storedLinksToContactChannels([
    { linkType: "Email", url: "mailto:team@example.edu" },
    { linkType: "Legacy X", url: "https://x.com/lub" },
  ])).toEqual([
    { kind: "Email", value: "team@example.edu" },
    { kind: "X", value: "https://x.com/lub" },
  ]);
});

import type { OrganizationProfileLink } from "./local-content";

export const organizationContactKinds = [
  "Website", "Email", "Phone", "LinkedIn", "GitHub", "Instagram", "X", "YouTube", "TikTok", "WhatsApp", "Telegram",
] as const;

export type OrganizationContactKind = typeof organizationContactKinds[number];
export const organizationContactAddableKinds = ["Email", "Phone", "Website", "LinkedIn", "X", "TikTok", "Instagram"] as const satisfies readonly OrganizationContactKind[];
export type OrganizationContactChannel = { kind: OrganizationContactKind; value: string };
export type NormalizedOrganizationContact = OrganizationContactChannel & { url: string };

const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

export function normalizeOrganizationContact(input: unknown): NormalizedOrganizationContact | null {
  if (!input || typeof input !== "object") return null;
  const { kind, value: rawValue } = input as { kind?: unknown; value?: unknown };
  if (typeof kind !== "string" || !organizationContactKinds.includes(kind as OrganizationContactKind) || typeof rawValue !== "string") return null;
  const value = rawValue.trim();
  if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return null;

  if (kind === "Email") {
    if (value.length > 320 || !emailPattern.test(value)) return null;
    return { kind: kind as OrganizationContactKind, value, url: `mailto:${value}` };
  }
  if (kind === "Phone") {
    const compact = value.replace(/[\s().-]/g, "");
    if (!/^\+?[0-9]{7,15}$/.test(compact)) return null;
    return { kind: kind as OrganizationContactKind, value: compact, url: `tel:${compact}` };
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || /\s/.test(value)) return null;
    return { kind: kind as OrganizationContactKind, value: url.toString(), url: url.toString() };
  } catch {
    return null;
  }
}

function inferKind(label: string, href: string): OrganizationContactKind {
  const details = `${label} ${href}`.toLowerCase();
  if (href.startsWith("mailto:") || /email|e-mail|بريد|ايميل|إيميل/.test(details)) return "Email";
  if (href.startsWith("tel:") || /phone|telephone|هاتف|جوال/.test(details)) return "Phone";
  if (/linkedin|لينكد/.test(details)) return "LinkedIn";
  if (/instagram|انستغرام|انستقرام/.test(details)) return "Instagram";
  if (/youtube|يوتيوب/.test(details)) return "YouTube";
  if (/tiktok|تيك.?توك/.test(details)) return "TikTok";
  if (/telegram|t\.me/.test(details)) return "Telegram";
  if (/github/.test(details)) return "GitHub";
  if (/whatsapp|wa\.me|واتساب/.test(details)) return "WhatsApp";
  if (/x\.com|twitter|تويتر/.test(details) || label.trim().toLowerCase() === "x") return "X";
  return "Website";
}

export function contactChannelFromProfileLink(link: OrganizationProfileLink): OrganizationContactChannel | null {
  if (!link.href) return null;
  const kind = inferKind(link.label, link.href);
  let value = link.value;
  if (kind === "Email" && link.href.startsWith("mailto:")) value = link.href.slice("mailto:".length);
  if (kind === "Phone" && link.href.startsWith("tel:")) value = link.href.slice("tel:".length);
  if (kind !== "Email" && kind !== "Phone" && link.href.startsWith("https:")) value = link.href;
  const normalized = normalizeOrganizationContact({ kind, value });
  return normalized ? { kind: normalized.kind, value: normalized.value } : null;
}

export function contactChannelFromStoredLink(linkType: string, url: string): OrganizationContactChannel | null {
  const kind = inferKind(linkType, url);
  let value = url;
  if (kind === "Email" && url.startsWith("mailto:")) value = url.slice("mailto:".length);
  if (kind === "Phone" && url.startsWith("tel:")) value = url.slice("tel:".length);
  const normalized = normalizeOrganizationContact({ kind, value });
  return normalized ? { kind: normalized.kind, value: normalized.value } : null;
}

export function profileLinksToContactChannels(links: readonly OrganizationProfileLink[] | undefined): OrganizationContactChannel[] {
  return (links ?? []).flatMap(link => {
    const channel = contactChannelFromProfileLink(link);
    return channel ? [channel] : [];
  });
}

export function storedLinksToContactChannels(links: readonly { linkType: string; url: string }[]): OrganizationContactChannel[] {
  return links.flatMap(link => {
    const normalized = normalizeOrganizationContact({ kind: link.linkType, value: link.url });
    if (normalized) return [{ kind: normalized.kind, value: normalized.value }];
    const legacy = contactChannelFromProfileLink({ label: link.linkType, value: link.url, href: link.url });
    return legacy ? [legacy] : [];
  });
}

export function organizationContactLabel(kind: string, en: boolean) {
  const labels: Record<OrganizationContactKind, [string, string]> = {
    Website: ["الموقع", "Website"], Email: ["البريد", "Email"], Phone: ["الهاتف", "Phone"],
    LinkedIn: ["LinkedIn", "LinkedIn"], GitHub: ["GitHub", "GitHub"], Instagram: ["Instagram", "Instagram"],
    X: ["X", "X"], YouTube: ["YouTube", "YouTube"], TikTok: ["TikTok", "TikTok"],
    WhatsApp: ["WhatsApp", "WhatsApp"], Telegram: ["Telegram", "Telegram"],
  };
  return labels[kind as OrganizationContactKind]?.[en ? 1 : 0] ?? (en ? "Contact" : "تواصل");
}

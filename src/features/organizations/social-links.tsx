import type { OrganizationProfileLink } from "./local-content";

type SocialIconName = "x" | "linkedin" | "instagram" | "youtube" | "tiktok" | "whatsapp" | "telegram" | "github" | "email" | "phone" | "website" | "link";

function iconName(link: OrganizationProfileLink): SocialIconName {
  const details = `${link.label} ${link.value} ${link.href ?? ""}`.toLowerCase();
  if (link.href?.startsWith("mailto:") || /email|e-mail|بريد|ايميل|إيميل/.test(details)) return "email";
  if (link.href?.startsWith("tel:") || /phone|telephone|هاتف|جوال/.test(details)) return "phone";
  if (/linkedin|لينكد/.test(details)) return "linkedin";
  if (/instagram|انستغرام|انستقرام/.test(details)) return "instagram";
  if (/youtube|يوتيوب/.test(details)) return "youtube";
  if (/tiktok|تيك.?توك/.test(details)) return "tiktok";
  if (/telegram|t\.me/.test(details)) return "telegram";
  if (/github/.test(details)) return "github";
  if (/whatsapp|wa\.me|واتساب/.test(details)) return "whatsapp";
  if (/x\.com|twitter|تويتر/.test(details) || link.label.trim().toLowerCase() === "x") return "x";
  if (/linktr\.ee|linktree/.test(details)) return "link";
  if (/website|web site|الموقع|موقع رسمي|contact|التواصل|الرابط/.test(details)) return "website";
  if (link.href?.startsWith("https:")) return "website";
  return "link";
}

function SocialIcon({ name }: { name: SocialIconName }) {
  const common = { viewBox: "0 0 24 24", width: 22, height: 22, "aria-hidden": true as const, focusable: false as const };
  switch (name) {
    case "x": return <svg {...common}><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.5l-5.1-6.7L5.7 22H2.5l7.3-8.3L1.8 2h6.7l4.6 6.1zm-1.1 17.8h1.7L7.3 4.1H5.5z" /></svg>;
    case "linkedin": return <svg {...common}><path fill="currentColor" d="M20.45 2H3.55A1.55 1.55 0 0 0 2 3.55v16.9A1.55 1.55 0 0 0 3.55 22h16.9A1.55 1.55 0 0 0 22 20.45V3.55A1.55 1.55 0 0 0 20.45 2ZM8.1 18.9H5.15V9.4H8.1ZM6.63 8.1a1.71 1.71 0 1 1 .02-3.42 1.71 1.71 0 0 1-.02 3.42Zm12.28 10.8h-2.94v-4.62c0-1.1-.02-2.5-1.53-2.5-1.53 0-1.76 1.2-1.76 2.42v4.7H9.74V9.4h2.82v1.3h.04a3.1 3.1 0 0 1 2.79-1.53c2.98 0 3.53 1.96 3.53 4.51Z" /></svg>;
    case "instagram": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.7" r=".8" fill="currentColor" stroke="none" /></svg>;
    case "youtube": return <svg {...common}><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6Z" /></svg>;
    case "tiktok": return <svg {...common}><path fill="currentColor" d="M19.6 7.1a5.7 5.7 0 0 1-3.8-1.5v8.2a5.7 5.7 0 1 1-5.7-5.7c.4 0 .8 0 1.2.1v3.2a2.6 2.6 0 1 0 1.4 2.4V2h3.2a5.7 5.7 0 0 0 3.7 3.2Z" /></svg>;
    case "whatsapp": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20l.8-4.7a8.5 8.5 0 1 1 16.7-3.6Z" /><path d="M8.1 8.1c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4 0 .7.5.9 1.2 1.6 2.1 2.1.3.2.5.2.7-.1l.7-.8c.2-.2.4-.3.7-.2l1.7.8c.3.1.4.3.4.5 0 .3-.2 1.2-.7 1.6-.5.5-1.2.7-2 .6-1-.1-2.1-.6-3.5-1.8-1.2-1-2.1-2.3-2.4-3.1-.4-1-.4-1.8-.2-2.4Z" /></svg>;
    case "telegram": return <svg {...common}><path fill="currentColor" d="M21.8 4.2 18.6 20c-.2 1.1-.9 1.3-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 13.4l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.3 3c.9-.3 1.8.2 1.5 1.2Z" /></svg>;
    case "github": return <svg {...common}><path fill="currentColor" d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.32-3.76-1.32-.5-1.28-1.24-1.62-1.24-1.62-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 .1.9 2.3 3.77 1.63.1-.72.4-1.22.69-1.5-2.48-.28-5.08-1.24-5.08-5.52 0-1.22.44-2.22 1.16-3-.12-.29-.5-1.42.11-2.96 0 0 .95-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.62 1.54.23 2.67.12 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.6 5.23-5.09 5.5.4.35.75 1.03.75 2.08v3.08c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" /></svg>;
    case "email": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
    case "phone": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-4.3-1.3-1.6 2a14.1 14.1 0 0 1-7.8-7.8l2-1.6Z" /></svg>;
    case "website": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3.5 12h17M12 3c2.3 2.4 3.3 5.4 3.3 9s-1 6.6-3.3 9c-2.3-2.4-3.3-5.4-3.3-9S9.7 5.4 12 3Z" /></svg>;
    default: return <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13.5 8.6 15a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M14 10.5l1.4-1.4a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0M8.8 12h6.4" /></svg>;
  }
}

export function SocialLinkIcons({ links, en }: { links: readonly OrganizationProfileLink[]; en: boolean }) {
  const uniqueLinks = new Map<string, OrganizationProfileLink>();
  for (const link of links) {
    if (link.href && !uniqueLinks.has(link.href)) uniqueLinks.set(link.href, link);
  }
  const items = [...uniqueLinks.values()];
  if (items.length === 0) return null;

  return <ul className="organization-social-list" aria-label={en ? "Contact and social links" : "روابط التواصل والحسابات الاجتماعية"}>
    {items.map(link => {
      const href = link.href!;
      const accessibleName = link.value && link.value !== href ? `${link.label}: ${link.value}` : link.label;
      const external = href.startsWith("https:");
      const linkName = external ? `${accessibleName} — ${en ? "opens in a new window" : "يفتح في نافذة جديدة"}` : accessibleName;
      return <li key={href}><a className="organization-social-link" href={href} aria-label={linkName} title={accessibleName} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
        <SocialIcon name={iconName(link)} />
      </a></li>;
    })}
  </ul>;
}

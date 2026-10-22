"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";

const loadChatWidget = () => import("./chat-widget").then(module => module.ChatWidget);
const LoadedChatWidget = dynamic(loadChatWidget, {
  ssr: false,
  loading: () => <span className="lub-chat-launcher" aria-hidden="true">…</span>,
});

export function DeferredChatWidget({ locale }: { locale: "ar" | "en" }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const en = locale === "en";
  const preload = () => { void loadChatWidget().catch(() => undefined); };

  if (pathname === "/ai") return null;
  if (mounted) return <LoadedChatWidget locale={locale} initiallyOpen />;

  return <button type="button" className="lub-chat-launcher" aria-haspopup="dialog" aria-expanded="false" aria-label={en ? "Open LUB assistant" : "فتح مساعد لُبّ"}
    onPointerEnter={preload} onFocus={preload} onClick={() => { preload(); setMounted(true); }}>
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3v-11a9 9 0 0 1 19 0Z"/><path d="M6 11h.01M11 11h.01M16 11h.01" strokeWidth="3" strokeLinecap="round"/></svg>
    <span>{en ? "Ask LUB" : "اسأل لُبّ"}</span>
  </button>;
}

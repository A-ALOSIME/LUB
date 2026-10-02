"use client";

import { useState } from "react";
import type { Locale, Theme } from "@/lib/preferences";

export function DisplayControls({ locale, theme }: { locale: Locale; theme: Theme }) {
  const [activeTheme, setActiveTheme] = useState(theme);
  function toggleTheme() {
    const next = activeTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `lub-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setActiveTheme(next);
  }
  function toggleLanguage() {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `lub-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }
  return <div className="flex items-center gap-2">
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={locale === "ar" ? activeTheme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن" : activeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={locale === "ar" ? activeTheme === "dark" ? "الوضع الفاتح" : "الوضع الداكن" : activeTheme === "dark" ? "Light mode" : "Dark mode"}>{activeTheme === "dark" ? "☀" : "☾"}</button>
    <button type="button" className="language-toggle" onClick={toggleLanguage} aria-label={locale === "ar" ? "Switch to English" : "التحويل إلى العربية"} lang={locale === "ar" ? "en" : "ar"}>{locale === "ar" ? "EN" : "عربي"}</button>
  </div>;
}

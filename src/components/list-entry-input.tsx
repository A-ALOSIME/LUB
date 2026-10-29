"use client";

import {t as translateUi} from "@/lib/i18n";
import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/preferences";

export function ListEntryInput({ id, label, value, onChange, locale, placeholder, maxLength = 5000 }: {
  id: string; label: string; value: string; onChange: (value: string) => void; locale: Locale; placeholder?: string; maxLength?: number;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const entries = value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const en = locale === "en";
  function add() {
    const entry = draft.trim();
    if (!entry) return;
    if (entries.includes(entry) || [...entries, entry].join("\n").length > maxLength) {
      setError(translateUi((en) ? "en" : "ar", "أضف عنصرًا غير مكرر ضمن الحد المسموح للحقل.", "Use a new item within the field's character limit."));
      return;
    }
    onChange([...entries, entry].join("\n"));
    setDraft("");
    setError("");
  }
  return <div className="list-entry-input">
    <ul className="list-entry-badges" aria-label={label}>
      {entries.map((entry, index) => <li key={`${index}-${entry}`}><Badge variant="secondary"><span dir="auto">{entry}</span><Button type="button" variant="ghost" size="icon-xs" aria-label={translateUi((en) ? "en" : "ar", `حذف ${entry}`, `Remove ${entry}`)} onClick={() => onChange(entries.filter((_, i) => i !== index).join("\n"))}><X aria-hidden="true" /></Button></Badge></li>)}
    </ul>
    <div className="flex min-w-0 items-center gap-2">
      <Input id={id} value={draft} placeholder={placeholder} maxLength={maxLength} onChange={event => { setDraft(event.target.value); setError(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); } }} />
      <Button type="button" variant="outline" size="sm" disabled={!draft.trim()} onClick={add}>{translateUi((en) ? "en" : "ar", "إضافة", "Add")}</Button>
    </div>
    <small className="text-xs text-muted-foreground">{translateUi((en) ? "en" : "ar", "أضف العنصر بالضغط على Enter", "Press Enter to add an item")}</small>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}

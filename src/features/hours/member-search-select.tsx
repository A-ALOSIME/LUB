"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {FormField} from "@/components/form-field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/preferences";

export function MemberSearchSelect({ members, locale = "ar" }: { members: Array<{ id: string; name: string }>; locale?: Locale }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string }>();
  const [open, setOpen] = useState(false);
  const en = locale === "en", c = (ar: string, english: string) => en ? english : ar;
  const filtered = members.filter(member => member.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 30);
  return <FormField id="hours-member-search" label={c("العضو", "Member")} className="relative">
    <div className="relative">
      <Input id="hours-member-search" role="combobox" aria-expanded={open} aria-controls="hours-member-options" aria-autocomplete="list" autoComplete="off" value={selected?.name ?? query} placeholder={c("ابحث عن عضو…", "Search for a member…")} onFocus={() => setOpen(true)} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false); }} onChange={event => { setSelected(undefined); setQuery(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && filtered[0]) { event.preventDefault(); setSelected(filtered[0]); setQuery(""); setOpen(false); } }} />
      <ChevronsUpDown aria-hidden="true" className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted"/>
    </div>
    <input type="hidden" name="member" value={selected?.id ?? ""} required/>
    {open && <ul id="hours-member-options" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
      {filtered.length ? filtered.map(member => <li key={member.id} role="option" aria-selected={selected?.id === member.id}><Button type="button" variant="ghost" className="w-full justify-between" onClick={() => { setSelected(member); setQuery(""); setOpen(false); }}><span className="truncate" dir="auto">{member.name}</span>{selected?.id === member.id && <Check aria-hidden="true" className="size-4"/>}</Button></li>) : <li className="px-3 py-2 text-sm text-muted">{c("لا يوجد عضو بهذا الاسم.", "No member found.")}</li>}
    </ul>}
    {selected && <p className="text-xs text-muted">{c("العضو المحدد", "Selected member")}: <bdi>{selected.name}</bdi></p>}
  </FormField>;
}

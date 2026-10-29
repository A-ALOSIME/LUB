"use client";

import {createTranslator} from "@/lib/i18n";
import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useProfileFormState } from "./profile-form-state";
import type { Locale } from "@/lib/preferences";

export function OrganizationInterestEditor(props: { initialInterests: string[]; locale: Locale }) {
  const { resetKey, resetValues } = useProfileFormState();
  const initialInterests = Object.hasOwn(resetValues, "tagNames")
    ? resetValues.tagNames.split(/[,،\n]/u).map(value => value.trim()).filter(Boolean)
    : props.initialInterests;
  return <OrganizationInterestEditorState key={resetKey} initialInterests={initialInterests} locale={props.locale} />;
}

function OrganizationInterestEditorState({ initialInterests, locale }: { initialInterests: string[]; locale: Locale }) {
  const [interests, setInterests] = useState(() => [...new Set(initialInterests.map(value => value.trim()).filter(Boolean))].slice(0, 10));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputId = useId();
  const { markChanged } = useProfileFormState();
  const en = locale === "en";
  const c = createTranslator(en ? "en" : "ar");

  function add() {
    const value = draft.trim();
    if (!value || /[,،\n]/u.test(value) || value.length > 40 || interests.includes(value)) {
      setError(c("اكتب مجالًا جديدًا حتى 40 حرفًا، من دون فواصل.", "Enter a new interest up to 40 characters, without commas."));
      return;
    }
    if (interests.length >= 10) {
      setError(c("يمكن إضافة عشرة مجالات على الأكثر.", "You can add up to 10 interests."));
      return;
    }
    setInterests(current => [...current, value]);
    markChanged();
    setDraft("");
    setError("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    add();
  }

  return <div className="organization-interest-editor">
    <input type="hidden" name="tagNames" value={interests.join(",")} readOnly />
    {interests.length > 0 && <ul className="organization-interest-list" aria-label={c("مجالات الاهتمام المحددة", "Selected interests")}>
      {interests.map(interest => <li key={interest}>
        <Badge variant="secondary"><span dir="auto">{interest}</span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={c(`حذف ${interest}`, `Remove ${interest}`)} onClick={() => { setInterests(current => current.filter(item => item !== interest)); setError(""); markChanged(); }}>
          <X aria-hidden="true" />
        </Button></Badge>
      </li>)}
    </ul>}
    <div className="organization-interest-add">
      <div className="flex min-w-0 items-center gap-2">
        <Input id={inputId} aria-label={c("مجال اهتمام جديد", "New interest")} placeholder={c("مثال: أمن سيبراني", "Example: cybersecurity")} dir={en ? "ltr" : "rtl"} className={en ? "text-left" : "text-right"} value={draft} onChange={event => { setDraft(event.target.value); setError(""); }} onKeyDown={handleKeyDown} maxLength={40} />
        <Button type="button" variant="outline" size="sm" disabled={!draft.trim() || interests.length >= 10} onClick={add} aria-label={c("إضافة المجال", "Add interest")}>{c("إضافة", "Add")}</Button>
      </div>
      <div className="organization-interest-meta" dir={en ? "ltr" : "rtl"}>
        <small dir={en ? "ltr" : "rtl"}>{c("أضف المجال بالضغط على Enter", "Press Enter to add an interest")}</small>
        <span className="organization-interest-count">{c(`${interests.length} من 10`, `${interests.length} of 10`)}</span>
      </div>
    </div>
    {error && <p role="alert" dir={en ? "ltr" : "rtl"} className="text-xs text-destructive">{error}</p>}
  </div>;
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";
import { searchKnowledge } from "./actions";
import type { SearchState } from "./client";

const initial: SearchState = { sources: null };

export function KnowledgeSearch({ locale = "ar" }: { locale?: Locale }) {
  const [question, setQuestion] = useState("");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  const [state, action, pending] = useActionState(searchKnowledge, initial);
  const error = useRef<HTMLParagraphElement>(null);
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  useEffect(() => { if (state.error) error.current?.focus(); }, [state]);

  async function copyResult() {
    if (!state.sources?.length) return;
    try {
      await navigator.clipboard.writeText(state.sources.map(source => `${source.title}\n${source.text}`).join("\n\n"));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return <>
    <form action={action} onSubmit={() => setCopyStatus(null)} className="ai-composer mt-8 p-4 sm:p-5">
      <label htmlFor="ai-question" className="sr-only">{c("سؤالك", "Your question")}</label>
      <textarea
        id="ai-question"
        name="question"
        required
        minLength={3}
        maxLength={500}
        rows={2}
        value={question}
        onChange={event => setQuestion(event.target.value)}
        placeholder={c("وش ودك تعرف؟", "What would you like to know?")}
        className="leading-8"
      />
      <div className="mt-2 flex justify-end">
        <button aria-label={pending ? c("جارٍ البحث", "Searching") : c("إرسال السؤال", "Send question")} className="flex size-10 items-center justify-center rounded-full bg-action text-[var(--button-ink)] hover:bg-action-hover" disabled={pending}>
          {pending ? <span aria-hidden="true" className="text-xl leading-none">…</span> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>}
        </button>
      </div>
      {state.error && <p ref={error} role="alert" tabIndex={-1} className="error-message mt-5">{actionFeedback(state.error, locale)}</p>}
    </form>

    <p className="mt-3 text-center text-xs leading-6 text-muted">{c("اسأل عن لُبّ فقط، بدون بيانات شخصية.", "Ask about LUB only; leave out personal details.")}</p>

    {!pending && state.sources !== null && <section className="mt-12" aria-live="polite" aria-label={c("نتيجة السؤال", "Question result")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-muted">{c("مقاطع ذات صلة", "Related excerpts")}</h2>
        {state.sources.length > 0 && <button type="button" onClick={copyResult} className="text-link text-sm">{c("نسخ النتيجة", "Copy result")}</button>}
      </div>
      {state.sources.length ? <ul className="mt-4 divide-y divide-line border-t border-line">
        {state.sources.map(source => <li key={source.id} className="py-5">
          <p dir="auto" className="leading-8 wrap-anywhere">{source.text}</p>
          <Link dir="auto" className="text-link mt-3 inline-block text-sm" href={source.url}>{source.title}</Link>
        </li>)}
      </ul> : <p className="mt-4 border-t border-line py-5 leading-8 text-muted">{c("ما لقيت مرجعًا مناسبًا. جرّب سؤالًا بصياغة أوضح.", "No matching reference found. Try a clearer question.")}</p>}
    </section>}
    {copyStatus && <p role="status" className="mt-3 text-sm text-muted">{copyStatus === "copied" ? c("نُسخت النتيجة.", "Result copied.") : c("تعذّر النسخ. حدّد النص وانسخه يدويًا.", "Copy failed. Select the text and copy it manually.")}</p>}
  </>;
}

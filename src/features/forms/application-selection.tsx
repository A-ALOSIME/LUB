"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/preferences";
import type { Application } from "./repository";

const statusLabels = {
  Submitted: { ar: "قيد المراجعة", en: "Under review" },
  Interview: { ar: "مقابلة", en: "Interview" },
  Accepted: { ar: "مقبول", en: "Accepted" },
  Rejected: { ar: "مرفوض", en: "Rejected" },
  Withdrawn: { ar: "منسحب", en: "Withdrawn" },
} as const;

export function ApplicationSelection({ rows, org, locale = "ar" }: { rows: Application[]; org: string; locale?: Locale }) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectable = rows.filter((application) => application.canBulk && ["Submitted", "Interview"].includes(application.status_code));

  return <>
    <label className="mb-4 flex items-center gap-3">
      <input
        type="checkbox"
        className="size-5"
        disabled={!selectable.length}
        checked={selectable.length > 0 && selectable.every((application) => selected.includes(application.id))}
        onChange={(event) => setSelected(event.target.checked ? selectable.map((application) => application.id) : [])}
      />
      {locale === "en" ? `Select all available applications on this page (${selectable.length})` : `تحديد كل الطلبات المتاحة في هذه الصفحة (${selectable.length})`}
    </label>
    <div className="divide-y divide-line">
      {rows.map((application) => <div key={application.id} className="flex items-start gap-3 py-4">
        {selectable.some((item) => item.id === application.id) && <input
          type="checkbox"
          className="mt-1 size-5 shrink-0"
          name="selected"
          value={application.id}
          checked={selected.includes(application.id)}
          onChange={(event) => setSelected(event.target.checked ? [...selected, application.id] : selected.filter((id) => id !== application.id))}
          aria-label={locale === "en" ? `Select application from ${application.name}` : `تحديد طلب ${application.name}`}
        />}
        <div>
          <Link href={`/manage/organizations/${org}/applications/${application.id}`} className="text-link" dir="auto">{application.name}</Link>
          <p className="mt-1 text-sm leading-7 text-muted">
            <span dir="auto">{application.title}</span> · {statusLabels[application.status_code as keyof typeof statusLabels]?.[locale] ?? application.status_code} · <span dir="auto">{application.major}</span> · {locale === "en" ? "Level" : "المستوى"} {application.level}{application.committee ? <> · <span dir="auto">{application.committee}</span></> : null}
          </p>
        </div>
      </div>)}
    </div>
  </>;
}


import {ContentText} from "@/components/content-text";
import {t as translateUi} from "@/lib/i18n";
import { ExternalLink, LockKeyhole } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RequestStatusBadge } from "./request-status-badge";
import type { Detail } from "./repository";
import type { Locale } from "@/lib/preferences";
import { formatRiyadhDateTime } from "@/lib/datetime";
export function ApplicationDetail({
  detail,
  locale = "ar",
}: {
  detail: Detail;
  locale?: Locale;
}) {
  const en = locale === "en",
    reason =
      detail.status_code === "Rejected"
        ? [...detail.history]
            .reverse()
            .find((h) => h.to_status_code === "Rejected")?.reason
        : null;
  return (
    <div className="flex flex-col gap-6">
      <RequestStatusBadge status={detail.status_code} locale={locale} />
      {reason && (
        <section>
          <h2 className="text-sm text-muted-foreground">
            {translateUi((en) ? "en" : "ar", "سبب الرفض", "Rejection reason")}
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed">{reason}</p>
        </section>
      )}
      <dl className="space-y-5">
        {detail.committee_labels?.legacy&&!detail.version.definition.sections.some(s=>s.fields.some(f=>f.type==='Committee'))&&<div><dt className="text-sm text-muted-foreground">{translateUi((en) ? "en" : "ar", 'اللجنة المطلوبة', 'Requested committee')}</dt><dd className="mt-1">{detail.committee_labels.legacy}</dd></div>}
        {detail.version.definition.sections
          .flatMap((s) => s.fields)
          .filter((f) => detail.answers[f.id] !== undefined)
          .map((f) => {
            const value = String(detail.answers[f.id]);
            return (
              <div key={f.id}>
                <dt dir="auto" className="text-sm text-muted-foreground">
                  <ContentText value={f.label}/>
                </dt>
                <dd
                  dir="auto"
                  className="mt-1 whitespace-pre-wrap break-words leading-relaxed"
                >
                  {f.type === "File" ? (
                    <a
                      className="text-primary"
                      href={`/files/${detail.answers[f.id]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {translateUi((en) ? "en" : "ar", "تنزيل المرفق", "Download attachment")}
                      <ExternalLink className="ms-1 inline size-3.5" />
                    </a>
                  ) : f.type === "Checkbox" ? (
                    translateUi((en) ? "en" : "ar", (
                      "موافق"
                    ), (
                      "Agreed"
                    ))
                  ) : f.type === 'Committee' ? (
                    detail.committee_labels?.answers[f.id]??(translateUi((en) ? "en" : "ar", 'لجنة لم تعد متاحة', 'Committee no longer available'))
                  ) : f.options.length ? (
                    (Array.isArray(detail.answers[f.id])
                      ? (detail.answers[f.id] as string[])
                      : [value]
                    )
                      .map(
                        (v) => f.options.find((o) => o.value === v)?.label ?? v,
                      )
                      .join(translateUi((en) ? "en" : "ar", "، ", ", "))
                  ) : value.startsWith("https://") && URL.canParse(value) ? (
                    <a
                      className="inline-flex max-w-full items-start gap-1 text-primary"
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <bdi className="break-all" dir="ltr">
                        {value}
                      </bdi>
                      <ExternalLink className="mt-1 size-3.5 shrink-0" />
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            );
          })}
      </dl>
      {detail.messages.length > 0 && (
        <section>
          <h2 className="font-medium">
            {translateUi((en) ? "en" : "ar", "رسائل المقابلة", "Interview messages")}
          </h2>
          {detail.messages.map((m, i) => (
            <p
              key={i}
              dir="auto"
              className="mt-3 whitespace-pre-wrap leading-relaxed"
            >
              <ContentText value={m.body}/>
            </p>
          ))}
        </section>
      )}
      <section>
        <h2 className="font-medium">
          {translateUi((en) ? "en" : "ar", "سجل الطلب", "Application history")}
        </h2>
        <ol className="mt-3 space-y-4 border-s border-border ps-4">
          {[...detail.history].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -start-5 top-2 size-2 rounded-full bg-muted-foreground" />
              <RequestStatusBadge status={h.to_status_code} locale={locale} />
              <p className="mt-1 text-sm text-muted-foreground">
                {formatRiyadhDateTime(h.created_at, locale)}
              </p>
              {h.reason && (
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {h.reason === "Undo"
                    ? translateUi((en) ? "en" : "ar", "تم التراجع عن القرار", "Decision undone")
                    : h.reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
      {detail.canReview && detail.notes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="size-4" />
              {translateUi((en) ? "en" : "ar", "للمراجعين فقط", "Reviewers only")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.notes.map((n, i) => (
              <p
                key={i}
                dir="auto"
                className="whitespace-pre-wrap leading-relaxed"
              >
                <ContentText value={n.body}/>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

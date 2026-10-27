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
            {en ? "Rejection reason" : "سبب الرفض"}
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed">{reason}</p>
        </section>
      )}
      <dl className="space-y-5">
        {detail.committee_labels?.legacy&&!detail.version.definition.sections.some(s=>s.fields.some(f=>f.type==='Committee'))&&<div><dt className="text-sm text-muted-foreground">{en?'Requested committee':'اللجنة المطلوبة'}</dt><dd className="mt-1">{detail.committee_labels.legacy}</dd></div>}
        {detail.version.definition.sections
          .flatMap((s) => s.fields)
          .filter((f) => detail.answers[f.id] !== undefined)
          .map((f) => {
            const value = String(detail.answers[f.id]);
            return (
              <div key={f.id}>
                <dt dir="auto" className="text-sm text-muted-foreground">
                  {f.label}
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
                      {en ? "Download attachment" : "تنزيل المرفق"}
                      <ExternalLink className="ms-1 inline size-3.5" />
                    </a>
                  ) : f.type === "Checkbox" ? (
                    en ? (
                      "Agreed"
                    ) : (
                      "موافق"
                    )
                  ) : f.type === 'Committee' ? (
                    detail.committee_labels?.answers[f.id]??(en?'Committee no longer available':'لجنة لم تعد متاحة')
                  ) : f.options.length ? (
                    (Array.isArray(detail.answers[f.id])
                      ? (detail.answers[f.id] as string[])
                      : [value]
                    )
                      .map(
                        (v) => f.options.find((o) => o.value === v)?.label ?? v,
                      )
                      .join(en ? ", " : "، ")
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
            {en ? "Interview messages" : "رسائل المقابلة"}
          </h2>
          {detail.messages.map((m, i) => (
            <p
              key={i}
              dir="auto"
              className="mt-3 whitespace-pre-wrap leading-relaxed"
            >
              {m.body}
            </p>
          ))}
        </section>
      )}
      <section>
        <h2 className="font-medium">
          {en ? "Application history" : "سجل الطلب"}
        </h2>
        <ol className="mt-3 space-y-4 border-s border-border ps-4">
          {detail.history.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -start-5 top-2 size-2 rounded-full bg-muted-foreground" />
              <RequestStatusBadge status={h.to_status_code} locale={locale} />
              <p className="mt-1 text-sm text-muted-foreground">
                {formatRiyadhDateTime(h.created_at, locale)}
              </p>
              {h.reason && (
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {h.reason === "Undo"
                    ? en
                      ? "Decision undone"
                      : "تم التراجع عن القرار"
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
              {en ? "Reviewers only" : "للمراجعين فقط"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.notes.map((n, i) => (
              <p
                key={i}
                dir="auto"
                className="whitespace-pre-wrap leading-relaxed"
              >
                {n.body}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

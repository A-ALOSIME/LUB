"use client";
import {createTranslator} from "@/lib/i18n";
import {majorLabel} from "@/lib/display";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, LockKeyhole } from "lucide-react";
import {
  RequestReviewTable,
  type ReviewDecision,
} from "@/features/forms/request-review-table";
import { RequestStatusBadge } from "@/features/forms/request-status-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { EventForm } from "./form";
import { Button } from "@/components/ui/button";
import { formatRiyadhDateTime } from "@/lib/datetime";
import { academicLevel } from "@/lib/display";
import type { Locale } from "@/lib/preferences";
import type { EventRegistrant } from "./review-repository";
import { mutateEvent } from "./actions";

export function EventRegistrationReview({
  items,
  locale,
}: {
  items: EventRegistrant[];
  locale: Locale;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    router = useRouter(),
    c = createTranslator((locale === "en") ? "en" : "ar");
  const detail = items.find((r) => r.id === selected);
  async function decide(
    ids: string[],
    status: ReviewDecision,
    message: string,
  ) {
    const f = new FormData();
    f.set("operation", "review");
    f.set("status", status);
    f.set("message", message);
    f.set("confirm", "on");
    ids.forEach((id) => f.append("selected", id));
    const result = await mutateEvent({}, f);
    if (result.success) {
      setSelected(null);
      router.refresh();
    }
    return result;
  }
  return (
    <RequestReviewTable
      locale={locale}
      rows={items.slice(0, 25).map((r) => ({
        id: r.id,
        name: r.name,
        subtitle: r.title,
        status: r.review_status_code,
        createdAt: r.created_at,
        completedDecisions: r.review_status_code === "Accepted" ? ["Accepted"] : [],
        selectable: r.canReview && r.review_status_code !== "Rejected",
        decisions: r.canReview
          ? r.review_status_code === "Pending"
            ? ["Accepted", "Rejected"]
            : r.review_status_code === "Accepted"
              ? ["Rejected"]
              : []
          : [],
      }))}
      onOpen={setSelected}
      onDecision={decide}
      bulkDecisions={
        items.some((r) => r.canReview) ? ["Accepted", "Rejected"] : []
      }
    >
      {(choose) =>
        detail && (
          <Sheet
            open
            onOpenChange={(open) => {
              if (!open) setSelected(null);
            }}
          >
            <SheetContent
              side="left"
              showCloseButton={false}
              className="management-action-sheet gap-0 overflow-hidden p-0"
              dir={locale === "en" ? "ltr" : "rtl"}
            >
              <SheetHeader className="management-action-header">
                <SheetTitle>{detail.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  <bdi>{majorLabel(detail.major,locale)}</bdi> ·{" "}
                  {academicLevel(detail.level, locale)}
                </p>
                <RequestStatusBadge
                  status={detail.review_status_code}
                  locale={locale}
                />
                <p className="text-sm text-muted-foreground">
                  {detail.title} ·{" "}
                  {formatRiyadhDateTime(detail.created_at, locale)}
                </p>
                <SheetClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute end-3 top-3"
                      aria-label={c("إغلاق", "Close")}
                    />
                  }
                >
                  <X />
                </SheetClose>
              </SheetHeader>
              <div className="management-action-scroll flex flex-col gap-5">
                <dl className="space-y-5">
                  {detail.definition?.sections
                    .flatMap((s) => s.fields)
                    .filter((f) => detail.answers?.[f.id] !== undefined)
                    .map((f) => (
                      <div key={f.id}>
                        <dt className="text-sm text-muted-foreground">
                          {f.label}
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
                          {f.type === "File" ? (
                            <a
                              className="text-primary"
                              href={`/files/${detail.answers?.[f.id]}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {c("تنزيل المرفق", "Download attachment")}
                            </a>
                          ) : f.options.length ? (
                            (Array.isArray(detail.answers?.[f.id])
                              ? (detail.answers![f.id] as string[])
                              : [String(detail.answers?.[f.id])]
                            )
                              .map(
                                (value) =>
                                  f.options.find((o) => o.value === value)
                                    ?.label ?? value,
                              )
                              .join("، ")
                          ) : (
                            String(detail.answers?.[f.id])
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
                {!detail.definition && (
                  <p className="text-muted-foreground">
                    {c(
                      "لا توجد أسئلة إضافية لهذا التسجيل.",
                      "No additional registration questions.",
                    )}
                  </p>
                )}
                {detail.review_note && (
                  <section>
                    <h3 className="text-sm text-muted-foreground">
                      {c(
                        "سبب القرار — يظهر للطالب",
                        "Decision reason — visible to the student",
                      )}
                    </h3>
                    <p className="whitespace-pre-wrap">{detail.review_note}</p>
                  </section>
                )}
                <section>
                  <h3 className="mb-3 font-medium">
                    {c("سجل الطلب", "Request history")}
                  </h3>
                  <ol className="space-y-4 border-s border-border ps-4">
                    {detail.history.map((h, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -start-5 top-2 size-2 rounded-full bg-muted-foreground" />
                        <RequestStatusBadge
                          status={h.status_code}
                          locale={locale}
                        />
                        <p className="text-sm text-muted-foreground">
                          {formatRiyadhDateTime(h.created_at, locale)}
                        </p>
                        {h.reason && (
                          <p className="whitespace-pre-wrap">{h.reason}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
                {detail.canAttend &&
                  detail.attendanceOpen &&
                  detail.review_status_code === "Accepted" && (
                    <EventForm
                      operation="attendance"
                      fields={{ registration: detail.id }}
                      label={c("حفظ الحضور", "Save attendance")}
                      locale={locale}
                    >
                      <FormField label={c("الحضور", "Attendance")}>
                        <NativeSelect
                          name="status"
                          defaultValue={detail.attendance}
                        >
                          <option value="Pending">
                            {c(
                              "بانتظار تأكيد الحضور",
                              "Awaiting attendance confirmation",
                            )}
                          </option>
                          <option value="Present">{c("حضر", "Present")}</option>
                          <option value="Absent">
                            {c("لم يحضر", "Absent")}
                          </option>
                          <option value="Excused">
                            {c("معذور", "Excused")}
                          </option>
                        </NativeSelect>
                      </FormField>
                    </EventForm>
                  )}
                {detail.canContribute &&
                  detail.review_status_code === "Accepted" && (
                    <EventForm
                      operation="contribution"
                      fields={{ registration: detail.id }}
                      label={c("إثبات المساهمة", "Record contribution")}
                      locale={locale}
                    >
                      <FormField label={c("نوع المساهمة", "Contribution type")}>
                        <NativeSelect name="kind">
                          <option value="Presenter">
                            {c("مقدم", "Presenter")}
                          </option>
                          <option value="Trainer">
                            {c("مدرب", "Trainer")}
                          </option>
                          <option value="Core_Contributor">
                            {c("مساهم أساسي", "Core contributor")}
                          </option>
                        </NativeSelect>
                      </FormField>
                      <FormField
                        label={c("وصف المساهمة", "Contribution description")}
                      >
                        <Input
                          name="title"
                          required
                          minLength={2}
                          maxLength={120}
                        />
                      </FormField>
                    </EventForm>
                  )}
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LockKeyhole className="size-4" />
                  {c(
                    "الحضور يُراجع بعد الفعالية بشكل منفصل.",
                    "Attendance is reviewed separately after the event.",
                  )}
                </p>
              </div>
              {detail.canReview && (
                <div className="management-action-footer is-modal-footer">
                  {detail.review_status_code === "Pending" && (
                    <Button onClick={() => choose([detail.id], "Accepted")}>
                      {c("قبول", "Accept")}
                    </Button>
                  )}
                  {detail.review_status_code !== "Rejected" && (
                    <Button
                      variant="danger-outline"
                      onClick={() => choose([detail.id], "Rejected")}
                    >
                      {c("رفض", "Reject")}
                    </Button>
                  )}
                  <ManagementActionSheet
                    label={c("إزالة التسجيل", "Remove registration")}
                    title={c(
                      `إزالة تسجيل ${detail.name}؟`,
                      `Remove ${detail.name}'s registration?`,
                    )}
                    locale={locale}
                    mobileBottomSheet
                  >
                    <EventForm
                      operation="remove-registration"
                      fields={{ registration: detail.id, confirm: "on" }}
                      label={c("تأكيد الإزالة", "Confirm removal")}
                      locale={locale}
                      onSuccess={() => setSelected(null)}
                    >
                      <p className="text-sm text-muted-foreground">
                        {c(
                          "سيُلغى التسجيل ويُحفظ سجله السابق.",
                          "The registration will be cancelled and its history retained.",
                        )}
                      </p>
                    </EventForm>
                  </ManagementActionSheet>
                </div>
              )}
            </SheetContent>
          </Sheet>
        )
      }
    </RequestReviewTable>
  );
}

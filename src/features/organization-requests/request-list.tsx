"use client";

import {ContentText} from "@/components/content-text";
import {t as translateUi,createTranslator} from "@/lib/i18n";
import {NumberText} from "@/components/number-text";
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from "@/components/ui/collapsible";
import { actionFeedback } from "@/lib/action-feedback";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Check, X, Building2, Plus, Undo2, ChevronDown } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { ManagementActionSheet } from "@/components/management-action-sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { RequestStatusBadge } from "@/features/forms/request-status-badge";
import { formatPersonalDate } from "@/features/organizations/personal-display";
import { useActionToast } from "@/components/action-toast";
import { mutateOpeningRequest, type OpeningRequestState } from "./actions";
import type { OpeningRequest, OpeningWorkspace } from "./repository";
import type { Locale } from "@/lib/preferences";
export function OpeningRequestList({
  data,
  locale,
  manage = false,
  status = "Pending",
  page = 0,
}: {
  data: OpeningWorkspace;
  locale: Locale;
  manage?: boolean;
  status?: string;
  page?: number;
}) {
  const en = locale === "en",
    c = createTranslator((en) ? "en" : "ar"),
    router = useRouter();
  const [selected, setSelected] = useState<OpeningRequest | null>(null),
    [decision, setDecision] = useState<
      "Accepted" | "Rejected" | "withdraw" | null
    >(null),
    [note, setNote] = useState("");
  const [state, action, pending] = useActionState<
    OpeningRequestState,
    FormData
  >(async (previous, form) => {
    const result = await mutateOpeningRequest(previous, form);
    if (result.success) {
      setDecision(null);
      setSelected(null);
      setNote("");
      router.refresh();
    }
    return result;
  }, {});
  useActionToast(state, locale);
  const detail = selected,
    href = (next: number) =>
      manage
        ? `/manage/organization-requests?status=${status}&page=${next}`
        : `/applications?tab=organizations&page=${next}`;
  return (
    <div className="flex flex-col gap-5" dir={en ? "ltr" : "rtl"}>
      {manage ? (
        <FilterTabs
          value={status}
          dir={en ? "ltr" : "rtl"}
          ariaLabel={c("حالة الطلب", "Request status")}
          options={(
            [
              { value: "Pending", label: c("قيد المراجعة", "Under review") },
              { value: "Accepted", label: c("مقبولة", "Accepted") },
              { value: "Rejected", label: c("مرفوضة", "Rejected") },
            ] as const
          ).map((item) => ({ ...item, count: data.counts[item.value] }))}
          onValueChange={(value) =>
            router.push(`/manage/organization-requests?status=${value}`)
          }
        />
      ) : (
        <Button render={<Link href="/organization-requests/new" />}>
          <Plus />
          {c("طلب فتح نادي أو مجلس", "Request a club or council")}
        </Button>
      )}
      {data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <p>{c("لا توجد طلبات لعرضها.", "No requests to display.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.items.slice(0, 25).map((item) => (
            <Card
              key={item.id}
              className="relative min-w-0 transition-colors hover:bg-muted/40"
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  {item.has_logo && (
                    <Image
                      src={`/organization-requests/${item.id}/logo`}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="size-12 rounded-lg object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle>
                      <button
                        type="button"
                        className="break-words text-start after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() => setSelected(item)}
                      >
                        <ContentText value={item.name_ar}/>
                      </button>
                    </CardTitle>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.type_code === "Club"
                        ? c("نادي", "Club")
                        : c("مجلس", "Council")}
                      {manage && <> · {item.applicant_name}</>} ·{" "}
                      <bdi>{formatPersonalDate(item.created_at, locale)}</bdi>
                    </p>
                  </div>
                  <RequestStatusBadge
                    status={
                      item.status_code === "Pending"
                        ? "Submitted"
                        : item.status_code
                    }
                    locale={locale}
                  />
                </div>
              </CardHeader>
              {!manage && item.decision_note && (
                <CardContent>
                  <p className="text-sm">
                    {c("سبب الرفض:", "Rejection reason:")} {item.decision_note}
                  </p>
                </CardContent>
              )}
              {!manage && item.organization_slug && (
                <CardFooter>
                  <Button
                    className="relative z-10"
                    variant="link"
                    render={<Link href={`/organizations/${item.organization_slug}`} />}
                  >
                    {c("فتح الجهة ←", "Open organization →")}
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
      {(page > 0 || data.items.length > 25) && (
        <nav
          className="flex items-center justify-between"
          aria-label={c("صفحات الطلبات", "Request pages")}
        >
          {page > 0 ? (
            <Button variant="outline" render={<Link href={href(page - 1)} />}>
              {c("السابق", "Previous")}
            </Button>
          ) : (
            <span />
          )}
          {data.items.length > 25 && (
            <Button variant="outline" render={<Link href={href(page + 1)} />}>
              {c("التالي", "Next")}
            </Button>
          )}
        </nav>
      )}
      <ManagementActionSheet
        label=""
        title={detail?.name_ar ?? c("تفاصيل الطلب", "Request details")}
        hideTrigger
        presentation="sheet"
        sheetClassName="sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:max-w-[calc(100vw-1.5rem)] sm:rounded-xl"
        locale={locale}
        open={!!detail}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        {detail && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <RequestStatusBadge
                status={
                  detail.status_code === "Pending"
                    ? "Submitted"
                    : detail.status_code
                }
                locale={locale}
              />
              <Badge variant="outline">
                {detail.type_code === "Club"
                  ? c("نادي", "Club")
                  : c("مجلس", "Council")}
              </Badge>
            </div>
            {detail.has_logo && (
              <Image
                src={`/organization-requests/${detail.id}/logo`}
                alt={c("شعار الجهة", "Organization logo")}
                width={128}
                height={128}
                unoptimized
                className="size-32 rounded-lg object-contain"
              />
            )}
            {manage && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {c("مقدم الطلب", "Applicant")}
                </p>
                <p>{detail.applicant_name}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">
                {c("تاريخ التقديم", "Submitted")}
              </p>
              <p>
                <bdi>{formatPersonalDate(detail.created_at, locale)}</bdi>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {c("النبذة", "Description")}
              </p>
              <RequestLongText key={`${detail.id}-summary`} value={detail.summary} en={en}/>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {c("الرسالة والأهداف", "Mission and goals")}
              </p>
              <RequestLongText key={`${detail.id}-mission`} value={detail.mission} en={en}/>
            </div>
            {detail.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.interests.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
            {detail.decision_note && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {c("سبب الرفض", "Rejection reason")}
                </p>
                <p className="mt-2">{detail.decision_note}</p>
              </div>
            )}
            {detail.status_code === "Pending" ? (
              <div className="management-action-footer is-modal-footer">
                {manage ? (
                  <>
                    <Button onClick={() => setDecision("Accepted")}>
                      <Check />
                      {c("قبول", "Accept")}
                    </Button>
                    <Button
                      variant="danger-outline"
                      onClick={() => setDecision("Rejected")}
                    >
                      <X />
                      {c("رفض", "Reject")}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setDecision("withdraw")}
                  >
                    <Undo2 />
                    {c("سحب الطلب", "Withdraw request")}
                  </Button>
                )}
              </div>
            ) : !manage &&
              ["Rejected", "Withdrawn"].includes(detail.status_code) ? (
              <Button
                render={
                  <Link href={`/organization-requests/new?from=${detail.id}`} />
                }
              >
                {c("تقديم مجددًا", "Apply again")}
              </Button>
            ) : null}
          </div>
        )}
      </ManagementActionSheet>
      <AlertDialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open && !pending) setDecision(null);
        }}
      >
        <AlertDialogContent
          className="organization-opening-confirmation"
          dir={en ? "ltr" : "rtl"}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === "Accepted"
                ? c(
                    `قبول طلب ${detail?.name_ar}؟`,
                    `Accept ${detail?.name_ar}?`,
                  )
                : decision === "Rejected"
                  ? c(
                      `رفض طلب ${detail?.name_ar}؟`,
                      `Reject ${detail?.name_ar}?`,
                    )
                  : c(
                      `سحب طلب ${detail?.name_ar}؟`,
                      `Withdraw ${detail?.name_ar}?`,
                    )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision === "Accepted"
                ? c(
                    "ستُنشأ الجهة بهذه البيانات ويُعيّن مقدم الطلب قائدًا لها. القرار نهائي.",
                    "Create this organization and appoint the applicant as its leader. This decision is final.",
                  )
                : decision === "Rejected"
                  ? c(
                      "سيظهر سبب الرفض لمقدم الطلب، ويمكنه تقديم طلب جديد.",
                      "The applicant will see the rejection reason and may apply again.",
                    )
                  : c(
                      "سيتوقف النظر في هذا الطلب، ويمكنك تقديم طلب جديد.",
                      "This request will leave review. You can submit a new request.",
                    )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="operation" value={decision ?? ""} />
            <input type="hidden" name="request" value={detail?.id ?? ""} />
            {decision === "Rejected" && (
              <FormField
                label={c("سبب الرفض", "Rejection reason")}
                required
                hint={c("يظهر لمقدم الطلب", "Visible to the applicant")}
              >
                <Textarea
                  name="note"
                  required
                  maxLength={1000}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  <bdi><NumberText value={note.length}/> / 1000</bdi>
                </p>
              </FormField>
            )}
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {actionFeedback(state.error, locale)}
                </AlertDescription>
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogAction
                type="submit"
                disabled={pending}
                variant={decision === "Rejected" ? "destructive" : "default"}
              >
                {pending
                  ? c("جاري الحفظ…", "Saving…")
                  : decision === "Accepted"
                    ? c("قبول وإنشاء الجهة", "Accept and create")
                    : decision === "Rejected"
                      ? c("تأكيد الرفض", "Confirm rejection")
                      : c("سحب الطلب", "Withdraw request")}
              </AlertDialogAction>
              <AlertDialogCancel disabled={pending}>
                {c("إلغاء", "Cancel")}
              </AlertDialogCancel>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RequestLongText({value,en}:{value:string;en:boolean}) {
 const [open,setOpen]=useState(false);
 if(value.length<=240)return <p className="mt-2 whitespace-pre-wrap break-words">{value}</p>;
 return <Collapsible open={open} onOpenChange={setOpen} className="mt-2"><p className="whitespace-pre-wrap break-words">{value.slice(0,240)}{!open&&"…"}</p><CollapsibleContent className="whitespace-pre-wrap break-words">{value.slice(240)}</CollapsibleContent><CollapsibleTrigger render={<Button variant="ghost" size="sm"/>}>{open?(translateUi((en) ? "en" : "ar", "عرض أقل", "Show less")):(translateUi((en) ? "en" : "ar", "عرض المزيد", "Show more"))}<ChevronDown className={open?"rotate-180":""}/></CollapsibleTrigger></Collapsible>;
}

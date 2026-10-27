"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {RequestStatusBadge} from "@/features/forms/request-status-badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ManagementActionSheet } from "@/components/management-action-sheet";
import { toast } from "@/components/ui/toast";
import { formatRiyadhDateTime } from "@/lib/datetime";
import type { Locale } from "@/lib/preferences";
import type { EventDetail } from "./repository";
import { EventRegistrationForm } from "./form";
import { mutateEvent } from "./actions";

type Props = Pick<
  EventDetail,
  "open" | "remaining" | "own" | "form" | "status" | "onboarded" | "committees"
> & {
  event: {
    id: string;
    title: string;
    status_code: string;
    registration_opens_at: string;
    opensLater: boolean;
  };
  user: boolean;
  locale: Locale;
};

export function PublicEventRegistration({
  event,
  open,
  remaining,
  own,
  form,
  status,
  onboarded,
  user,
  locale,
  committees=[],
}: Props) {
  const [pending, start] = useTransition(),
    [withdraw, setWithdraw] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const c = (ar: string, en: string) => (locale === "en" ? en : ar);
  function submit(operation: "register" | "cancel") {
    start(async () => {
      const fields = new FormData();
      fields.set("operation", operation);
      fields.set("event", event.id);
      if (own) fields.set("registration", own.id);
      fields.set("confirm", "on");
      try {
        const result = await mutateEvent({}, fields);
        if (result.error) {
          setError(result.error);
          toast.add({ title: result.error, type: "error", timeout: 0 });
          return;
        }
        setWithdraw(false);
        setError("");
        toast.add({
          title:
            operation === "cancel"
              ? c("تم إلغاء التسجيل", "Registration cancelled")
              : c("تم إرسال التسجيل", "Registration submitted"),
          type: "success",
          timeout: 3000,
        });
        router.refresh();
      } catch {
        setError(
          c(
            "تعذّر تنفيذ الإجراء. أعد المحاولة.",
            "The action failed. Please try again.",
          ),
        );
      }
    });
  }
  const active = own?.status_code === "Registered";
  let control;
  if (active)
    control = (
      <div className="flex flex-wrap items-center gap-3">
        <RequestStatusBadge status={own?.review_status_code??"Accepted"} locale={locale}/>
        <Button
          variant="outline"
          disabled={!open || pending}
          onClick={() => setWithdraw(true)}
        >
          {c("إلغاء التسجيل", "Cancel registration")}
        </Button>
      </div>
    );
  else if (own?.status_code === "Cancelled")
    control = (
      <Button disabled className="w-full">
        {c("أُلغي التسجيل", "Registration cancelled")}
      </Button>
    );
  else if (!open || remaining === 0) {
    const upcoming = event.status_code === "Published" && event.opensLater;
    control = (
      <Button
        disabled
        className="h-auto min-h-10 w-full whitespace-normal py-3"
      >
        {remaining === 0
          ? c("ممتلئ", "Full")
          : upcoming
            ? c(
                `يفتح التسجيل في ${formatRiyadhDateTime(event.registration_opens_at, locale)}`,
                `Registration opens ${formatRiyadhDateTime(event.registration_opens_at, locale)}`,
              )
            : c("التسجيل مغلق", "Registration closed")}
      </Button>
    );
  } else if (!user)
    control = (
      <Button
        nativeButton={false}
        className="w-full"
        render={
          <Link
            href={`/login?next=${encodeURIComponent(`/events/${event.id}`)}`}
          />
        }
      >
        {c("سجّل في الفعالية", "Register for event")}
      </Button>
    );
  else if (status !== "Active" || !onboarded)
    control = (
      <Button
        nativeButton={false}
        className="w-full"
        render={
          <Link
            href={`/onboarding?next=${encodeURIComponent(`/events/${event.id}`)}`}
          />
        }
      >
        {c("أكمل حسابك للتسجيل", "Complete your account to register")}
      </Button>
    );
  else if (form)
    control = (
      <ManagementActionSheet
        label={c("سجّل في الفعالية", "Register for event")}
        title={event.title}
        variant="default"
        triggerSize="lg"
        locale={locale}
        mobileBottomSheet
      >
        <EventRegistrationForm
          event={event.id}
          round=""
          version={form.id}
          definition={form.definition}
          committees={committees}
          locale={locale}
        />
      </ManagementActionSheet>
    );
  else
    control = (
      <Button
        className="w-full"
        disabled={pending}
        onClick={() => submit("register")}
      >
        {pending && <Spinner />}
        {pending
          ? c("جارٍ التسجيل…", "Registering…")
          : c("سجّل في الفعالية", "Register for event")}
      </Button>
    );
  return (
    <div className="public-event-registration">
      <div className="public-event-cta">{control}</div>{active&&own.review_status_code==="Rejected"&&own.review_note&&<p className="mt-2 text-sm text-muted-foreground">{own.review_note}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <AlertDialog open={withdraw} onOpenChange={setWithdraw}>
        <AlertDialogContent dir={locale === "en" ? "ltr" : "rtl"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {c(
                `إلغاء التسجيل في «${event.title}»؟`,
                `Cancel registration for “${event.title}”?`,
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {c(
                "سيتغير تسجيلك إلى ملغى، ولن تُحتسب لك مشاركة في هذه الفعالية.",
                "Your registration will be cancelled and will not count as participation in this event.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="danger-outline"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                submit("cancel");
              }}
            >
              {c("تأكيد الإلغاء", "Confirm cancellation")}
            </AlertDialogAction>
            <AlertDialogCancel disabled={pending}>
              {c("البقاء", "Keep registration")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

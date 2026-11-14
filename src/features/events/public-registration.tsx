"use client";

import {createTranslator} from "@/lib/i18n";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {CircleCheck} from "lucide-react";
import { Button } from "@/components/ui/button";
import {RequestStatusBadge} from "@/features/forms/request-status-badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    [error, setError] = useState("");
  const router = useRouter();
  const c = createTranslator((locale === "en") ? "en" : "ar");
  function submit(operation: "register") {
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
        setError("");
        toast.add({
          title:
            c("تم إرسال التسجيل", "Registration submitted"),
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
  if (active && own.review_status_code !== "Rejected" && own.attendance === "Present")
    control = (
      <Alert className="w-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
        <CircleCheck aria-hidden/>
        <AlertDescription className="text-current">{c("تم رصد حضورك", "Your attendance was recorded")}</AlertDescription>
      </Alert>
    );
  else if (active)
    control = (
      <div className="flex flex-wrap items-center gap-3">
        <RequestStatusBadge status={own?.review_status_code??"Accepted"} locale={locale}/>

      </div>
    );
  else if (own?.status_code === "Cancelled")
    control = (
      <RequestStatusBadge status="Withdrawn" locale={locale}/>
    );
  else if (!open || remaining === 0) {
    const upcoming = event.status_code === "Published" && event.opensLater;
    control = (
      <Button
        disabled
        className="h-auto min-h-10 w-full whitespace-normal py-3"
      >
        {remaining === 0
          ? c("اكتملت المقاعد", "Event is full")
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
        className="min-h-10 w-full whitespace-normal"
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
        className="min-h-10 w-full whitespace-normal"
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
        triggerSize="default"
        triggerClassName="w-full min-h-10"
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
        className="min-h-10 w-full whitespace-normal"
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
    <div className="flex min-w-0 flex-col gap-2">
      {control}
      {active&&own.review_status_code==="Rejected"&&own.review_note&&<p className="mt-2 text-sm text-muted-foreground">{own.review_note}</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

    </div>
  );
}

"use client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { mutateHours, type HoursState } from "./actions";
import type { Locale } from "@/lib/preferences";
import { actionFeedback } from "@/lib/action-feedback";
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
import { ManagementActionFooter } from "@/components/management-action-sheet";
import { useActionToast } from "@/components/action-toast";

export function HoursForm({
  operation,
  fields = {},
  label,
  children,
  locale = "ar",
  onSuccess,
  buttonClassName,
  disabled = false,
}: {
  operation: string;
  fields?: Record<string, string>;
  label: string;
  children?: ReactNode;
  locale?: Locale;
  onSuccess?: () => void;
  buttonClassName?: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<HoursState, FormData>(
    mutateHours,
    {},
  );
  const alert = useRef<HTMLParagraphElement>(null);
  const submitted = useRef<FormData | null>(null),
    [dismissedDuplicate, setDismissedDuplicate] = useState<HoursState | null>(
      null,
    );
  useActionToast(state, locale);
  useEffect(() => {
    if (state.error) alert.current?.focus();
    if (state.success) onSuccess?.();
  }, [state, onSuccess]);
  return (
    <>
      <form
        action={action}
        onSubmit={(event) => {
          submitted.current = new FormData(event.currentTarget);
        }}
        onReset={(e) => e.preventDefault()}
        className="space-y-4"
      >
        <input type="hidden" name="operation" value={operation} />
        {Object.entries(fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          {children}
          <ManagementActionFooter
            label={
              pending ? (locale === "en" ? "Saving…" : "جارٍ الحفظ…") : label
            }
            pending={pending}
            disabled={disabled}
            buttonClassName={buttonClassName}
          />
        </fieldset>
        {state.error && (
          <p ref={alert} role="alert" tabIndex={-1} className="error-message">
            {actionFeedback(state.error, locale)}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-action">
            {actionFeedback(state.success, locale)}
          </p>
        )}
      </form>
      <AlertDialog
        open={Boolean(state.duplicate && state !== dismissedDuplicate)}
        onOpenChange={(open) => {
          if (!open) setDismissedDuplicate(state);
        }}
      >
        <AlertDialogContent dir={locale === "en" ? "ltr" : "rtl"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "en"
                ? "Add a duplicate hours record?"
                : "إضافة سجل ساعات مكرر؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "en"
                ? "A matching record exists for this member, date, reason and hours. Is another entry intentional?"
                : "يوجد سجل للعضو نفسه بالتاريخ والسبب وعدد الساعات نفسها. هل تقصد إضافة سجل آخر؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (submitted.current) {
                  const next = new FormData();
                  submitted.current.forEach((v, k) => next.append(k, v));
                  next.set("confirmDuplicate", "on");
                  startTransition(() => action(next));
                  setDismissedDuplicate(state);
                }
              }}
            >
              {locale === "en" ? "Add another record" : "إضافة سجل آخر"}
            </AlertDialogAction>
            <AlertDialogCancel>
              {locale === "en" ? "Cancel" : "إلغاء"}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

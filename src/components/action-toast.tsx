"use client";

import { useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { actionFeedback } from "@/lib/action-feedback";
import type { Locale } from "@/lib/preferences";

export function useActionToast(state: { error?: string; success?: string }, locale: Locale = "ar", successTitle?: string) {
  useEffect(() => {
    if (state.error) toast.add({ title: actionFeedback(state.error, locale), type: "error", timeout: 0 });
    else if (state.success) toast.add({ title: successTitle ?? actionFeedback(state.success, locale), type: "success", timeout: 3000 });
  }, [state, locale, successTitle]);
}

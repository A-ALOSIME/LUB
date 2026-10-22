"use client";

import { useRef, type FormEvent, type FormHTMLAttributes, type ReactNode } from "react";

/** Submits select/date filters as soon as they change and debounces text search. */
export function LiveFilterForm({ children, className = "", debounceMs = 250, action, method }: {
  children: ReactNode;
  className?: string;
  debounceMs?: number;
  action?: FormHTMLAttributes<HTMLFormElement>["action"];
  method?: "get" | "post";
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target instanceof HTMLInputElement && ["text", "search"].includes(target.type)) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => form.requestSubmit(), debounceMs);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    form.requestSubmit();
  }

  return <form action={action} method={action ? undefined : method ?? "get"} onChange={handleChange} className={className}>{children}</form>;
}

"use client";
import { useEffect, useId, useState } from "react";
import { FormField } from "@/components/form-field";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { findOrganizationLeader } from "./admin-organization-actions";
import type { Locale } from "@/lib/preferences";
export function LeaderEmailSearch({
  locale,
  required = false,
}: {
  locale: Locale;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId(),
    en = locale === "en";
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [items, setItems] = useState<Array<{ name: string; email: string; major?: string }>>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 3) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError(false);
      findOrganizationLeader(query)
        .then((values) => {
          if (active) setItems(values);
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <FormField
      id={id}
      label={
        <>
          {en ? "Leader email" : "بريد القائد"}
          {!required && (
            <span className="text-muted-foreground">
              {en ? " (optional)" : " (اختياري)"}
            </span>
          )}
        </>
      }
      required={required}
      hint={
        en
          ? "Search for an active, verified student account."
          : "ابحث عن حساب طالب نشط ومتحقق من بريده."
      }
    >
      <input type="hidden" name="email" value={query} />
      <Combobox
        open={open}
        onOpenChange={setOpen}
        items={items.map((item) => item.email)}
        filter={null}
        value={selected}
        inputValue={query}
        onInputValueChange={(value, details) => {
          setQuery(value);
          if (details.reason === "input-change") {
            setItems([]);
            setLoading(value.trim().length >= 3);
            setOpen(value.trim().length >= 3);
          }
        }}
        onValueChange={(value) => {
          setSelected(value);
          setOpen(false);
          setQuery(value ?? "");
        }}
      >
        <ComboboxInput
          id={id}
          aria-label={en ? "Leader email" : "بريد القائد"}
          className="w-full"
          dir="ltr"
          type="email"
          required={required}
          maxLength={254}
          placeholder="student@example.com"
          showTrigger={false}
        />
        <ComboboxContent className="min-w-0">
          <ComboboxEmpty>
            {loading
              ? en
                ? "Searching…"
                : "جاري البحث…"
              : error
                ? en
                  ? "Could not search. Try again."
                  : "تعذّر البحث. حاول مجددًا."
                : query.length < 3
                  ? en
                    ? "Type at least three characters"
                    : "اكتب ثلاثة أحرف على الأقل"
                  : en
                    ? "No matching account"
                    : "لا يوجد حساب مطابق"}
          </ComboboxEmpty>
          <ComboboxList>
            {(email: string) => (
              <ComboboxItem key={email} value={email}>
                <span className="flex min-w-0 flex-col gap-1">
                  <span>
                    {items.find((item) => item.email === email)?.name}
                  </span>
                  <span className="text-sm text-muted-foreground">{items.find((item) => item.email === email)?.major}</span>
                  <bdi className="text-sm text-muted-foreground">{email}</bdi>
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormField>
  );
}

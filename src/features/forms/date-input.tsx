"use client";

import { useId, useState, type ReactElement, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Locale } from "@/lib/preferences";

function dateFromValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function currentRiyadhDateTime(value?: string) {
  if (!value) return { date: "", time: "" };
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

function formatDate(value: string, locale: Locale) {
  if (!value) return "";
  const date = dateFromValue(value);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA-u-nu-latn", {
    dateStyle: "medium", timeZone: "UTC", calendar: "gregory",
  }).format(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)));
}

function CalendarGrid({ value, locale, onSelect }: { value: string; locale: Locale; onSelect: (date: string) => void }) {
  const selected = value ? dateFromValue(value) : new Date();
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const weekStart = locale === "ar" ? 6 : 0;
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const offset = (firstWeekday - weekStart + 7) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA-u-nu-latn", {
    month: "long", year: "numeric", calendar: "gregory", timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 15, 12)));
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const day = (weekStart + index) % 7;
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar-SA-u-nu-latn", {
      weekday: "short", timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 0, 4 + day, 12)));
  });
  const previousMonth = () => setMonth(new Date(year, monthIndex - 1, 1, 12));
  const nextMonth = () => setMonth(new Date(year, monthIndex + 1, 1, 12));
  const PreviousIcon = locale === "ar" ? ChevronRight : ChevronLeft;
  const NextIcon = locale === "ar" ? ChevronLeft : ChevronRight;
  const c = (ar: string, english: string) => locale === "en" ? english : ar;

  return <div className="w-[19rem] max-w-[calc(100vw-2rem)]" dir={locale === "en" ? "ltr" : "rtl"}>
    <div className="mb-2 flex items-center justify-between gap-2">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={c("الشهر السابق", "Previous month")} onClick={previousMonth}><PreviousIcon aria-hidden="true" /></Button>
      <span className="text-sm font-semibold" aria-live="polite">{monthLabel}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={c("الشهر التالي", "Next month")} onClick={nextMonth}><NextIcon aria-hidden="true" /></Button>
    </div>
    <div className="grid grid-cols-7 gap-0.5 text-center" data-week-start={locale === "ar" ? "saturday" : "sunday"}>
      {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`} className="flex min-h-7 items-center justify-center whitespace-nowrap text-[0.7rem] font-medium text-muted" aria-hidden="true">{weekday}</span>)}
      {Array.from({ length: 42 }, (_, index) => {
        const day = index - offset + 1;
        if (day < 1 || day > daysInMonth) return <span key={`blank-${index}`} aria-hidden="true" />;
        const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const chosen = value === date;
        return <Button key={date} type="button" size="icon-sm" variant={chosen ? "secondary" : "ghost"} aria-pressed={chosen} aria-label={formatDate(date, locale)} onClick={() => onSelect(date)}>
          {new Intl.NumberFormat(locale === "en" ? "en" : "ar-SA-u-nu-latn", { useGrouping: false }).format(day)}
        </Button>;
      })}
    </div>
  </div>;
}

function CalendarPopover({ value, locale, children, onSelect, onTimeChange, time, required, extra }: {
  value: string;
  locale: Locale;
  children: ReactElement;
  onSelect: (date: string) => void | false;
  onTimeChange?: (time: string) => void;
  time?: string;
  required?: boolean;
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const c = (ar: string, english: string) => locale === "en" ? english : ar;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger nativeButton={false} render={children} />
    <PopoverContent
      align="start"
      side="bottom"
      collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
      className="date-picker-popover w-auto max-w-[calc(100vw-1rem)] p-3"
    >
      <CalendarGrid key={value} value={value} locale={locale} onSelect={date => { const keepOpen = onSelect(date) === false; if (!keepOpen) setOpen(false); }} />
      {onTimeChange && <label className="mt-3 grid gap-1.5 text-sm font-medium">{c("الوقت","Time")}<Input type="text" inputMode="numeric" autoComplete="off" placeholder="12:00" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" aria-label={c("الوقت","Time")} value={time ?? ""} required={required && Boolean(value)} onChange={event => onTimeChange(event.target.value)} /></label>}
      {extra}
      <p className="mt-2 text-xs text-muted">{c("كل الأوقات بتوقيت الرياض","All times are in Riyadh time")}</p>
    </PopoverContent>
  </Popover>;
}

export function DatePickerField({ name, label, required = false, value: initial = "", locale = "ar" }: {
  name: string; label: string; required?: boolean; value?: string; locale?: Locale;
}) {
  const [value, setValue] = useState(initial);
  const id = useId();
  const c = (ar: string, english: string) => locale === "en" ? english : ar;
  return <div className="grid min-w-0 gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <CalendarPopover value={value} locale={locale} onSelect={setValue}>
      <Input id={id} type="text" readOnly required={required} value={formatDate(value, locale)} placeholder={c("اختر التاريخ", "Choose a date")} aria-expanded={undefined} className="cursor-pointer" />
    </CalendarPopover>
    <input type="hidden" name={name} value={value} />
  </div>;
}

export function DateInput({ name, label, required = false, value: initial, locale = "ar" }: {
  name: string; label: string; required?: boolean; value?: string; locale?: Locale;
}) {
  const initialValue = currentRiyadhDateTime(initial);
  const [date, setDate] = useState(initialValue.date);
  const [time, setTime] = useState(initialValue.time);
  const id = useId();
  const c = (ar: string, english: string) => locale === "en" ? english : ar;
  const dateTimeLabel = date ? `${formatDate(date, locale)}${time ? ` · ${time}` : ""}` : "";
  const value = date && time ? `${date}T${time}:00+03:00` : "";
  return <div className="grid min-w-0 gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <CalendarPopover value={date} locale={locale} onSelect={selected => { setDate(selected); setTime(current => current || "12:00"); return false; }} onTimeChange={setTime} time={time} required={required}>
      <Input id={id} type="text" readOnly required={required} value={dateTimeLabel} placeholder={c("اختر التاريخ والوقت", "Choose a date and time")} className="cursor-pointer" />
    </CalendarPopover>
    <input type="hidden" name={name} value={value} />
  </div>;
}

export function DateRangeInput({ startName, endName, label, startValue = "", endValue = "", required = false, includeTime = false, locale = "ar" }: {
  startName: string;
  endName: string;
  label: string;
  startValue?: string;
  endValue?: string;
  required?: boolean;
  includeTime?: boolean;
  locale?: Locale;
}) {
  const start = includeTime ? currentRiyadhDateTime(startValue) : { date: startValue, time: "" };
  const end = includeTime ? currentRiyadhDateTime(endValue) : { date: endValue, time: "" };
  const [startDate, setStartDate] = useState(start.date);
  const [endDate, setEndDate] = useState(end.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(end.time);
  const [selectingEnd, setSelectingEnd] = useState(Boolean(start.date && !end.date));
  const id = useId();
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;
  const startLabel = `${formatDate(startDate, locale)}${includeTime && startTime ? ` · ${startTime}` : ""}`;
  const endLabel = `${formatDate(endDate, locale)}${includeTime && endTime ? ` · ${endTime}` : ""}`;
  const value = [startLabel, endLabel].filter(Boolean).join(` ${c("إلى", "to")} `);
  const handleSelect = (date: string) => {
    if (!selectingEnd || !startDate || endDate) {
      setStartDate(date);
      setEndDate("");
      setSelectingEnd(true);
      if (includeTime) setStartTime(current => current || "12:00");
      return false;
    }
    if (date < startDate) {
      setStartDate(date);
      setEndDate("");
      if (includeTime) setStartTime(current => current || "12:00");
      return false;
    }
    setEndDate(date);
    setSelectingEnd(false);
    if (includeTime) setEndTime(current => current || "12:00");
  };
  const timeFields = includeTime && <div className="mt-3 grid grid-cols-2 gap-2">
    <label className="grid min-w-0 gap-1 text-xs font-medium">{c("وقت البداية", "Start time")}<Input type="text" inputMode="numeric" autoComplete="off" placeholder="12:00" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" aria-label={c("وقت البداية", "Start time")} value={startTime} required={required && Boolean(startDate)} onChange={event => setStartTime(event.target.value)} /></label>
    <label className="grid min-w-0 gap-1 text-xs font-medium">{c("وقت النهاية", "End time")}<Input type="text" inputMode="numeric" autoComplete="off" placeholder="13:00" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" aria-label={c("وقت النهاية", "End time")} value={endTime} required={required && Boolean(endDate)} onChange={event => setEndTime(event.target.value)} /></label>
  </div>;
  const startOutput = includeTime
    ? startDate && startTime ? `${startDate}T${startTime}:00+03:00` : ""
    : startDate;
  const endOutput = includeTime
    ? endDate && endTime ? `${endDate}T${endTime}:00+03:00` : ""
    : endDate;

  return <Field className="gap-1.5">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <CalendarPopover value={selectingEnd && startDate ? startDate : endDate || startDate} locale={locale} onSelect={handleSelect} extra={timeFields}>
      <Input id={id} type="text" readOnly required={required} value={value} placeholder={c("اختر الفترة", "Choose a date range")} className="cursor-pointer text-sm text-foreground" />
    </CalendarPopover>
    <input type="hidden" name={startName} value={startOutput} />
    <input type="hidden" name={endName} value={endOutput} />
  </Field>;
}

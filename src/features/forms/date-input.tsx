"use client";
import { useId, useState, type ReactElement, type ReactNode } from "react";
import { CalendarDays, X } from "lucide-react";
import { arSA, enGB } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatRiyadhDate, formatRiyadhDateTime } from "@/lib/datetime";
import type { Locale } from "@/lib/preferences";

function dayValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromValue(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function riyadhToday() {
  return dateFromValue(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
}

function currentRiyadhDateTime(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime()))
    return { date: "", time: "12:00" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function TimeSelect({
  label,
  value,
  onChange,
  locale = "ar",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale?: Locale;
}) {
  const en = locale === "en",
    [hour, minute] = (value || "12:00").split(":").map(Number),
    period = hour >= 12 ? "pm" : "am";
  const change = (h: number, m: number, p: string) =>
    onChange(
      `${String((h % 12) + (p === "pm" ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={label}>
        <NativeSelect
          aria-label={`${label}: ${en ? "hour" : "الساعة"}`}
          value={hour % 12 || 12}
          onChange={(e) => change(Number(e.target.value), minute, period)}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={`${label}: ${en ? "minutes" : "الدقائق"}`}
          value={minute}
          onChange={(e) => change(hour, Number(e.target.value), period)}
        >
          {[0, 15, 30, 45, ...(minute % 15 ? [minute] : [])]
            .sort((a, b) => a - b)
            .map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
        </NativeSelect>
        <NativeSelect
          aria-label={`${label}: ${en ? "period" : "الفترة"}`}
          value={period}
          onChange={(e) => change(hour, minute, e.target.value)}
        >
          <option value="am">{en ? "AM" : "ص"}</option>
          <option value="pm">{en ? "PM" : "م"}</option>
        </NativeSelect>
      </div>
    </Field>
  );
}

function CalendarPanel({
  value,
  end,
  locale,
  onSelect,
  future = false,
}: {
  value: string;
  end?: string;
  locale: Locale;
  onSelect: (date: string) => void;
  future?: boolean;
}) {
  const en = locale === "en",
    today = riyadhToday();
  const shared = {
    locale: en ? enGB : arSA,
    numerals: "latn" as const,
    weekStartsOn: 0 as const,
    dir: en ? "ltr" : "rtl",
    today,
    disabled: future ? { before: today } : undefined,
    startMonth: future
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : undefined,
    defaultMonth: value ? dateFromValue(value) : today,
    className: "app-calendar",
    showOutsideDays: false,
    formatters: {
      formatCaption: (d: Date) =>
        new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA-u-nu-latn", {
          month: "long",
          year: "numeric",
          calendar: "gregory",
        }).format(d),
      formatWeekdayName: (d: Date) =>
        new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA", {
          weekday: "short",
        }).format(d),
    },
    labels: {
      labelPrevious: () => (en ? "Previous month" : "الشهر السابق"),
      labelNext: () => (en ? "Next month" : "الشهر التالي"),
    },
  };
  return (
    <div data-week-start="sunday">
      {end !== undefined ? (
        <Calendar
          {...shared}
          mode="range"
          selected={
            value
              ? {
                  from: dateFromValue(value),
                  to: end ? dateFromValue(end) : undefined,
                }
              : undefined
          }
          onDayClick={(date) => onSelect(dayValue(date))}
        />
      ) : (
        <Calendar
          {...shared}
          mode="single"
          selected={value ? dateFromValue(value) : undefined}
          onSelect={(date) => {
            if (date) onSelect(dayValue(date));
          }}
        />
      )}
    </div>
  );
}

function CalendarPopup({
  open,
  onOpenChange,
  label,
  trigger,
  children,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  trigger: ReactElement;
  children: ReactNode;
  locale: Locale;
}) {
  const mobile = useIsMobile(),
    en = locale === "en";
  if (mobile)
    return (
      <>
        <Button
          type="button"
          variant="outline"
          className="date-picker-mobile-trigger w-full justify-start font-normal"
          data-empty={!(trigger.props as { value?: string }).value}
          onClick={() => onOpenChange(true)}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <CalendarDays aria-hidden="true" />
          {(trigger.props as { value?: string; placeholder?: string }).value ||
            (trigger.props as { placeholder?: string }).placeholder}
        </Button>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="date-picker-mobile-sheet max-h-[95dvh] overflow-y-auto"
            dir={en ? "ltr" : "rtl"}
          >
            <SheetHeader>
              <SheetTitle>{label}</SheetTitle>
              <SheetClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute end-3 top-3"
                    aria-label={en ? "Close calendar" : "إغلاق التقويم"}
                  />
                }
              >
                <X />
              </SheetClose>
            </SheetHeader>
            <div className="p-4">{children}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger nativeButton={false} render={trigger} />
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionAvoidance={{
            side: "none",
            align: "none",
            fallbackAxisSide: "none",
          }}
          className="date-picker-popover"
          dir={en ? "ltr" : "rtl"}
        >
          {children}
        </PopoverContent>
      </Popover>
      {open && <div className="date-picker-reserve" aria-hidden="true" />}
    </>
  );
}

export function DatePickerField({
  name,
  label,
  required = false,
  value: initial = "",
  locale = "ar",
}: {
  name: string;
  label: string;
  required?: boolean;
  value?: string;
  locale?: Locale;
}) {
  const [value, setValue] = useState(initial),
    [open, setOpen] = useState(false),
    id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <CalendarPopup
        open={open}
        onOpenChange={setOpen}
        label={label}
        locale={locale}
        trigger={
          <Input
            id={id}
            type="text"
            readOnly
            required={required}
            value={value ? formatRiyadhDate(value, locale) : ""}
            placeholder={locale === "en" ? "Choose a date" : "اختر التاريخ"}
            className="cursor-pointer font-normal"
          />
        }
      >
        <CalendarPanel
          value={value}
          locale={locale}
          onSelect={(date) => {
            setValue(date);
            setOpen(false);
          }}
        />
      </CalendarPopup>
      <input type="hidden" name={name} value={value} />
    </Field>
  );
}

export function DateInput({
  name,
  label,
  required = false,
  value: initial,
  locale = "ar",
}: {
  name: string;
  label: string;
  required?: boolean;
  value?: string;
  locale?: Locale;
}) {
  const initialValue = currentRiyadhDateTime(initial),
    [date, setDate] = useState(initialValue.date),
    [time, setTime] = useState(initialValue.time),
    [open, setOpen] = useState(false),
    id = useId(),
    en = locale === "en";
  const output = date ? `${date}T${time}:00+03:00` : "";
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <CalendarPopup
        open={open}
        onOpenChange={setOpen}
        label={label}
        locale={locale}
        trigger={
          <Input
            id={id}
            readOnly
            required={required}
            value={output ? formatRiyadhDateTime(output, locale) : ""}
            placeholder={en ? "Choose date and time" : "اختر التاريخ والوقت"}
            className="cursor-pointer font-normal"
          />
        }
      >
        <FieldGroup>
          <CalendarPanel
            future
            value={date}
            locale={locale}
            onSelect={setDate}
          />
          <TimeSelect
            label={en ? "Time" : "الوقت"}
            value={time}
            onChange={setTime}
            locale={locale}
          />
          <FieldDescription>
            {en ? "All times are in Riyadh time" : "كل الأوقات بتوقيت الرياض"}
          </FieldDescription>
          <Button type="button" onClick={() => setOpen(false)}>
            {en ? "Done" : "تم"}
          </Button>
        </FieldGroup>
      </CalendarPopup>
      <input type="hidden" name={name} value={output} />
    </Field>
  );
}

export function DateRangeInput({
  startName,
  endName,
  label,
  startValue = "",
  endValue = "",
  required = false,
  includeTime = false,
  locale = "ar",
}: {
  startName: string;
  endName: string;
  label: string;
  startValue?: string;
  endValue?: string;
  required?: boolean;
  includeTime?: boolean;
  locale?: Locale;
}) {
  const start = includeTime
      ? currentRiyadhDateTime(startValue)
      : { date: startValue, time: "12:00" },
    end = includeTime
      ? currentRiyadhDateTime(endValue)
      : { date: endValue, time: "12:00" };
  const [startDate, setStartDate] = useState(start.date),
    [endDate, setEndDate] = useState(end.date),
    [startTime, setStartTime] = useState(start.time),
    [endTime, setEndTime] = useState(end.time),
    [open, setOpen] = useState(false),
    id = useId(),
    en = locale === "en";
  const startOutput = startDate
      ? includeTime
        ? `${startDate}T${startTime}:00+03:00`
        : startDate
      : "",
    endOutput = endDate
      ? includeTime
        ? `${endDate}T${endTime}:00+03:00`
        : endDate
      : "";
  const invalid = Boolean(
    startOutput && endOutput && (includeTime ? new Date(endOutput) <= new Date(startOutput) : endDate < startDate),
  );
  const summary = startOutput
    ? `${en ? "From" : "من"} ${includeTime ? formatRiyadhDateTime(startOutput, locale, true) : formatRiyadhDate(startOutput, locale, true)}${endOutput ? ` ${en ? "to" : "إلى"} ${includeTime ? formatRiyadhDateTime(endOutput, locale, true) : formatRiyadhDate(endOutput, locale, true)}` : ""}`
    : "";
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <CalendarPopup
        open={open}
        onOpenChange={setOpen}
        label={label}
        locale={locale}
        trigger={
          <Input
            id={id}
            readOnly
            required={required}
            aria-invalid={invalid}
            aria-describedby={`${id}-summary`}
            value={
              startDate
                ? [
                    formatRiyadhDate(startDate, locale),
                    endDate ? formatRiyadhDate(endDate, locale) : "",
                  ]
                    .filter(Boolean)
                    .join(en ? " to " : " إلى ")
                : ""
            }
            placeholder={en ? "Choose a date range" : "اختر الفترة"}
            className="cursor-pointer font-normal"
          />
        }
      >
        <FieldGroup>
          <CalendarPanel
            value={startDate}
            end={endDate}
            locale={locale}
            future={includeTime}
            onSelect={(date) => {
              if (!startDate || endDate) {
                setStartDate(date);
                setEndDate("");
              } else setEndDate(date);
            }}
          />
          {includeTime && (
            <>
              <TimeSelect
                label={en ? "Start time" : "وقت البداية"}
                value={startTime}
                onChange={setStartTime}
                locale={locale}
              />
              <TimeSelect
                label={en ? "End time" : "وقت النهاية"}
                value={endTime}
                onChange={setEndTime}
                locale={locale}
              />
              <FieldDescription>
                {en
                  ? "All times are in Riyadh time"
                  : "كل الأوقات بتوقيت الرياض"}
              </FieldDescription>
            </>
          )}
          {invalid && (
            <FieldError>
              {en
                ? "End must be after start."
                : "يجب أن تكون النهاية بعد البداية."}
            </FieldError>
          )}
          <Button
            type="button"
            disabled={invalid || !endDate}
            onClick={() => setOpen(false)}
          >
            {en ? "Done" : "تم"}
          </Button>
        </FieldGroup>
      </CalendarPopup>
      <FieldDescription id={`${id}-summary`}>{summary}</FieldDescription>
      {invalid && (
        <FieldError>
          {en ? "End must be after start." : "يجب أن تكون النهاية بعد البداية."}
        </FieldError>
      )}
      <input type="hidden" name={startName} value={startOutput} />
      <input type="hidden" name={endName} value={invalid ? "" : endOutput} />
    </Field>
  );
}

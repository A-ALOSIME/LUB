"use client";
import {formatNumber,localizeDigits,t as translateUi} from "@/lib/i18n";
import { useId, useState, type ReactElement, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
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
import { CompactTimeInput } from "./compact-time-input";
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
      `${String((h % 12) + (p === "pm" ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2,"0")}`,
    );
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={label}>
        <NativeSelect
          aria-label={`${label}: ${translateUi((en) ? "en" : "ar", "الساعة", "hour")}`}
          value={hour % 12 || 12}
          onChange={(e) => change(Number(e.target.value), minute, period)}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {formatNumber(i+1,locale)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={`${label}: ${translateUi((en) ? "en" : "ar", "الدقائق", "minutes")}`}
          value={minute}
          onChange={(e) => change(hour, Number(e.target.value), period)}
        >
          {[0, 15, 30, 45, ...(minute % 15 ? [minute] : [])]
            .sort((a, b) => a - b)
            .map((m) => (
              <option key={m} value={m}>
                {localizeDigits(String(m).padStart(2,"0"))}
              </option>
            ))}
        </NativeSelect>
        <NativeSelect
          aria-label={`${label}: ${translateUi((en) ? "en" : "ar", "الفترة", "period")}`}
          value={period}
          onChange={(e) => change(hour, minute, e.target.value)}
        >
          <option value="am">{translateUi((en) ? "en" : "ar", "ص", "AM")}</option>
          <option value="pm">{translateUi((en) ? "en" : "ar", "م", "PM")}</option>
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
  afterCalendar, footer,
}: {
  value: string;
  end?: string;
  locale: Locale;
  onSelect: (date: string) => void;
  future?: boolean;
  afterCalendar?: ReactNode; footer?: ReactNode;
}) {
  const en = locale === "en",
    today = riyadhToday();
  const [month,setMonth] = useState(value ? dateFromValue(value) : today);
  const monthName = new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA-u-ca-gregory-nu-latn", {month:"long",year:"numeric"}).format(month);
  const moveMonth = (delta:number) => setMonth(new Date(month.getFullYear(),month.getMonth()+delta,1));
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
    month,
    onMonthChange: setMonth,
    hideNavigation: true,
    classNames: {month_caption:"period-calendar-caption"},
    className: "app-calendar",
    showOutsideDays: false,
    formatters: {
      formatCaption: (d: Date) =>
        new Intl.DateTimeFormat(en ? "en-GB" : "ar-SA-u-nu-latn", {
          month: "long",
          year: "numeric",
          calendar: "gregory",
        }).format(d),
      formatWeekdayName: (d: Date) => translateUi((en) ? "en" : "ar", ["ح","ن","ث","ر","خ","ج","س"][d.getDay()], d.toLocaleDateString("en-GB",{weekday:"short"})),
    },
    labels: {
      labelDayButton: (day:Date) => formatRiyadhDate(day,locale,true),
      labelPrevious: () => (translateUi((en) ? "en" : "ar", "الشهر السابق", "Previous month")),
      labelNext: () => (translateUi((en) ? "en" : "ar", "الشهر التالي", "Next month")),
    },
  };
  return (
    <div data-week-start="sunday" className="calendar-frame">
      <div className="period-calendar-header">
        <Button type="button" variant="ghost" size="icon" aria-label={translateUi((en) ? "en" : "ar", "الشهر السابق", "Previous month")} disabled={future&&month.getFullYear()===today.getFullYear()&&month.getMonth()===today.getMonth()} onClick={()=>moveMonth(-1)}>{en?<ChevronLeft/>:<ChevronRight/>}</Button>
        <span aria-live="polite">{monthName}</span>
        <Button type="button" variant="ghost" size="icon" aria-label={translateUi((en) ? "en" : "ar", "الشهر التالي", "Next month")} onClick={()=>moveMonth(1)}>{en?<ChevronRight/>:<ChevronLeft/>}</Button>
      </div>
      <div className="period-picker-middle">
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
      {afterCalendar}</div>{footer}
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
          id={(trigger.props as {id?:string}).id}
          className="date-picker-mobile-trigger w-full justify-start font-normal"
          data-empty={!(trigger.props as { value?: string }).value}
          onClick={() => onOpenChange(true)}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <CalendarDays aria-hidden="true" />
          {(trigger.props as { value?: string; placeholder?: string }).value ||
            (trigger.props as { placeholder?: string }).placeholder || (translateUi((en) ? "en" : "ar", "اختر الفترة", "Choose period"))}
        </Button>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="date-picker-mobile-sheet max-h-[95dvh] overflow-hidden"
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
                    aria-label={translateUi((en) ? "en" : "ar", "إغلاق التقويم", "Close calendar")}
                  />
                }
              >
                <X />
              </SheetClose>
            </SheetHeader>
            <div className="date-picker-mobile-body">{children}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  return (
    <div className="min-w-0">
      <Popover open={open} onOpenChange={next=>onOpenChange(next)}>
        <PopoverTrigger nativeButton={trigger.type === Button} render={trigger} />
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          collisionAvoidance={{side:"flip",align:"shift",fallbackAxisSide:"none"}}
          collisionPadding={10}
          className="date-picker-popover"
          dir={en ? "ltr" : "rtl"}
        >
          {children}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DatePickerField({
  name,
  label,
  required = false,
  value: initial = "",
  locale = "ar",
  onValueChange,
  error,
}: {
  name: string;
  label: string;
  required?: boolean;
  value?: string;
  locale?: Locale;
  onValueChange?: (value: string) => void;
  error?: string;
}) {
  const [value, setValue] = useState(initial),
    [open, setOpen] = useState(false),
    id = useId();
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}{required && <span className="text-destructive" aria-hidden="true">*</span>}</FieldLabel>
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
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            value={value ? formatRiyadhDate(value, locale) : ""}
            placeholder={translateUi((locale === "en") ? "en" : "ar", "اختر التاريخ", "Choose a date")}
            className="cursor-pointer font-normal"
          />
        }
      >
        <CalendarPanel
          value={value}
          locale={locale}
          onSelect={(date) => {
            setValue(date);
            onValueChange?.(date);
            setOpen(false);
          }}
        />
      </CalendarPopup>
      <input type="hidden" name={name} value={value} />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

export function DateInput({
  name,
  label,
  required = false,
  value: initial,
  locale = "ar",
  onValueChange,
}: {
  name: string;
  label: string;
  required?: boolean;
  value?: string;
  locale?: Locale;
  onValueChange?: (value: string) => void;
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
            placeholder={translateUi((en) ? "en" : "ar", "اختر التاريخ والوقت", "Choose date and time")}
            className="cursor-pointer font-normal"
          />
        }
      >
        <CalendarPanel future value={date} locale={locale} onSelect={next=>{setDate(next);onValueChange?.(`${next}T${time}:00+03:00`);}}
          afterCalendar={<><TimeSelect label={translateUi((en) ? "en" : "ar", "الوقت", "Time")} value={time} onChange={next=>{setTime(next);onValueChange?.(date?`${date}T${next}:00+03:00`:"");}} locale={locale}/><FieldDescription>{translateUi((en) ? "en" : "ar", "كل الأوقات بتوقيت الرياض", "All times are in Riyadh time")}</FieldDescription></>}
          footer={<div className="period-picker-footer"><Button type="button" onClick={() => setOpen(false)}>{translateUi((en) ? "en" : "ar", "تم", "Done")}</Button></div>}/>

      </CalendarPopup>
      <input type="hidden" name={name} value={output} />
    </Field>
  );
}

export function DateRangeInput({startName,endName,label,startValue="",endValue="",required=false,includeTime=false,locale="ar"}:{startName:string;endName:string;label:string;startValue?:string;endValue?:string;required?:boolean;includeTime?:boolean;locale?:Locale}) {
  const start=includeTime?currentRiyadhDateTime(startValue):{date:startValue,time:"12:00"};
  const end=includeTime?currentRiyadhDateTime(endValue):{date:endValue,time:"23:59"};
  const [startDate,setStartDate]=useState(start.date),[endDate,setEndDate]=useState(end.date),[startTime,setStartTime]=useState(start.time),[endTime,setEndTime]=useState(endValue?end.time:"23:59"),[open,setOpen]=useState(false),[touched,setTouched]=useState(false),[validStart,setValidStart]=useState(true),[validEnd,setValidEnd]=useState(true);
  const id=useId(),en=locale==="en";
  const [reset,setReset] = useState(0);
  const startOutput=startDate?(includeTime?`${startDate}T${startTime}:00+03:00`:startDate):"",endOutput=endDate?(includeTime?`${endDate}T${endTime}:00+03:00`:endDate):"";
  const invalid=!!(startOutput&&endOutput&&(includeTime?new Date(endOutput)<=new Date(startOutput):endDate<startDate))||!validStart||!validEnd;
  const complete=!!(startOutput&&endOutput&&!invalid);
  const endpoint=(value:string)=>{
    const date=new Date(includeTime?value:`${value}T12:00:00+03:00`),language=en?"en-GB":"ar-SA-u-ca-gregory-nu-latn";
    const day=new Intl.DateTimeFormat(language,{timeZone:"Asia/Riyadh",day:"numeric",month:"long"}).format(date);
    return includeTime?`${day} ${new Intl.DateTimeFormat(language,{timeZone:"Asia/Riyadh",hour:"numeric",minute:"2-digit",hour12:true}).format(date)}`:day;
  };
  const summary=startOutput?`${endpoint(startOutput)}${endOutput?` ${en?"→":"←"} ${endpoint(endOutput)}`:""}`:"";
  const message=invalid?(translateUi((en) ? "en" : "ar", "أدخل وقتًا صالحًا، ويجب أن تكون النهاية بعد البداية.", "Enter a valid time; end must be after start.")):touched&&!complete?(translateUi((en) ? "en" : "ar", "اختر بداية الفترة ونهايتها.", "Choose the start and end of the period.")):"";
  return <Field className="shared-period-field" data-invalid={!!message||undefined}>
    <FieldLabel htmlFor={id}>{label}{required&&<span className="text-destructive" aria-hidden="true">*</span>}</FieldLabel>
    <CalendarPopup open={open} onOpenChange={setOpen} label={label} locale={locale} trigger={<Button id={id} aria-label={label} type="button" variant="outline" className="period-trigger" value={summary} aria-invalid={!!message} aria-required={required} aria-describedby={`${id}-hint`}><CalendarDays/><span>{startOutput?<><bdi>{endpoint(startOutput)}</bdi>{endOutput&&<>{en?<ArrowRight/>:<ArrowLeft/>}<bdi>{endpoint(endOutput)}</bdi></>}</>:translateUi((en) ? "en" : "ar", "اختر الفترة", "Choose a period")}</span></Button>}>
      <div className="period-picker-content">
        <CalendarPanel value={startDate} end={endDate} locale={locale} future={includeTime} onSelect={date=>{setTouched(true);if(!startDate||endDate){setStartDate(date);setEndDate("");}else setEndDate(date);}}
          afterCalendar={<>{includeTime&&<div className="period-times"><CompactTimeInput key={`start-${reset}`} label={translateUi((en) ? "en" : "ar", "البداية", "Start")} value={startTime} onChange={setStartTime} onValidity={setValidStart} locale={locale}/><CompactTimeInput key={`end-${reset}`} label={translateUi((en) ? "en" : "ar", "النهاية", "End")} value={endTime} onChange={setEndTime} onValidity={setValidEnd} locale={locale}/></div>}{summary&&<p className="period-selection-summary"><bdi>{summary}</bdi></p>}{message&&<FieldError>{message}</FieldError>}</>}
          footer={<div className="period-picker-footer"><Button type="button" disabled={!complete} onClick={()=>setOpen(false)}>{translateUi((en) ? "en" : "ar", "تم", "Done")}</Button><Button type="button" variant="ghost" onClick={()=>{setStartDate("");setEndDate("");setStartTime("12:00");setEndTime("23:59");setValidStart(true);setValidEnd(true);setTouched(false);setReset(value=>value+1);}}>{translateUi((en) ? "en" : "ar", "مسح", "Clear")}</Button></div>}/>

      </div>
    </CalendarPopup>
    <FieldDescription id={`${id}-hint`}>{includeTime?(translateUi((en) ? "en" : "ar", "بتوقيت الرياض", "Riyadh time")):summary}</FieldDescription>
    {message&&<FieldError role="alert">{message}</FieldError>}
    {<input className="sr-only" tabIndex={-1} aria-hidden="true" required={required||!!startDate||!!endDate||invalid} value={complete?"valid":""} onChange={()=>{}} onInvalid={event=>{event.preventDefault();setTouched(true);if(Array.from(event.currentTarget.form?.elements??[]).find(element=>"willValidate" in element&&(element as HTMLInputElement).willValidate&&!(element as HTMLInputElement).validity.valid)===event.currentTarget)document.getElementById(id)?.focus();}}/>}
    <input type="hidden" name={startName} value={startOutput}/><input type="hidden" name={endName} value={complete?endOutput:""}/>
  </Field>;
}

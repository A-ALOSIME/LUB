"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { academicLevel, formatHours } from "@/lib/display";
import { talentHref, talentQuery, type TalentFilters } from "./filters";
import { arabicSearchKey, skillKey, skillLabel } from "./skill-normalization";

export function TalentSearch({
  initial,
  options,
  en,
}: {
  initial: TalentFilters;
  options: { skills: string[]; majors: string[] };
  en: boolean;
}) {
  const router = useRouter(),
    [filters, setFilters] = useState(initial),
    [previous, setPrevious] = useState(talentQuery(initial));
  const current = talentQuery(initial),
    draft = talentQuery(filters);
  if (previous !== current) {
    setPrevious(current);
    setFilters(initial);
  }
  useEffect(() => {
    if (draft === current) return;
    const timer = setTimeout(
      () => router.replace(talentHref(filters), { scroll: false }),
      250,
    );
    return () => clearTimeout(timer);
  }, [draft, current, router, filters]);
  const c = (ar: string, english: string) => (en ? english : ar);
  const patch = (value: Partial<TalentFilters>) =>
    setFilters({ ...filters, ...value, page: 0 });
  const labels = new Map(
    options.skills.map((x) => [skillKey(x), skillLabel(x)]),
  );
  const name = (x: string) => labels.get(x) ?? skillLabel(x);
  const chips = [
    ...filters.skills.map((skill) => ({
      key: `skill-${skill}`,
      label: name(skill),
      clear: () => patch({ skills: filters.skills.filter((v) => v !== skill) }),
    })),
    ...(filters.major
      ? [
          {
            key: "major",
            label: filters.major,
            clear: () => patch({ major: "" }),
          },
        ]
      : []),
    ...(filters.level
      ? [
          {
            key: "level",
            label: academicLevel(filters.level, en ? "en" : "ar"),
            clear: () => patch({ level: "" }),
          },
        ]
      : []),
    ...(filters.minHours
      ? [
          {
            key: "hours",
            label:
              c("من ", "At least ") +
              formatHours(filters.minHours, en ? "en" : "ar"),
            clear: () => patch({ minHours: 0 }),
          },
        ]
      : []),
  ];
  const controls = (
    <TalentFilterFields
      value={filters}
      options={options}
      en={en}
      onChange={patch}
    />
  );
  return (
    <div className="my-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="q"
            value={filters.q}
            maxLength={120}
            aria-label={c(
              "البحث بالاسم أو التخصص أو المهارة أو الجهة",
              "Search by name, major, skill or organization",
            )}
            placeholder={c(
              "ابحث بالاسم أو التخصص أو المهارة أو الجهة…",
              "Search by name, major, skill or organization…",
            )}
            onChange={(e) => patch({ q: e.target.value })}
          />
          {filters.q && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={c("مسح البحث", "Clear search")}
                onClick={() => patch({ q: "" })}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
              <SlidersHorizontal />
              {c("الفلاتر", "Filters")}
              {chips.length > 0 && (
                <Badge variant="secondary">{chips.length}</Badge>
              )}
            </SheetTrigger>
            <SheetContent side={en ? "left" : "right"}
                closeLabel={c("إغلاق الفلاتر","Close filters")} dir={en ? "ltr" : "rtl"}>
              <SheetHeader>
                <SheetTitle>{c("تصفية المواهب", "Talent filters")}</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto p-5">{controls}</div>
              <SheetFooter>
                <SheetClose render={<Button />}>
                  {c("عرض النتائج", "Show results")}
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="hidden md:block">{controls}</div>
      {chips.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label={c("الفلاتر النشطة", "Active filters")}
        >
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1">
              <bdi>{chip.label}</bdi>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={c(
                        `إزالة فلتر ${chip.label}`,
                        `Remove ${chip.label} filter`,
                      )}
                      onClick={chip.clear}
                    />
                  }
                >
                  <X />
                </TooltipTrigger>
                <TooltipContent>
                  {c("إزالة الفلتر", "Remove filter")}
                </TooltipContent>
              </Tooltip>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({
                ...initial,
                q: "",
                skills: [],
                major: "",
                level: "",
                minHours: 0,
                sort: "relevance",
                page: 0,
              })
            }
          >
            {c("مسح الكل", "Clear all")}
          </Button>
        </div>
      )}
    </div>
  );
}
function TalentFilterFields({
  value,
  options,
  en,
  onChange,
}: {
  value: TalentFilters;
  options: { skills: string[]; majors: string[] };
  en: boolean;
  onChange: (v: Partial<TalentFilters>) => void;
}) {
  const anchor = useComboboxAnchor(),
    c = (ar: string, english: string) => (en ? english : ar);
  const catalog = new Map(
    options.skills.map((x) => [skillKey(x), skillLabel(x)]),
  );
  const keys = [...new Set([...catalog.keys(), ...value.skills])];
  const label = (key: string) => catalog.get(key) ?? skillLabel(key);
  return (
    <FieldGroup className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Field className="md:col-span-2">
        <FieldLabel>{c("المهارات", "Skills")}</FieldLabel>
        <Combobox
          multiple
          items={keys}
          value={value.skills}
          onValueChange={(skills) => onChange({ skills })}
          filter={(item, query) =>
            arabicSearchKey(label(item)).includes(arabicSearchKey(query)) ||
            skillKey(item).includes(skillKey(query))
          }
        >
          <ComboboxChips ref={anchor}>
            <ComboboxValue>
              {(values: string[]) =>
                values.map((key) => (
                  <ComboboxChip
                    key={key}
                    removeLabel={c(
                      `إزالة مهارة ${label(key)}`,
                      `Remove ${label(key)}`,
                    )}
                  >
                    <bdi>{label(key)}</bdi>
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
            <ComboboxChipsInput
              aria-label={c("اختيار المهارات", "Choose skills")}
              placeholder={
                value.skills.length ? undefined : c("كل المهارات", "All skills")
              }
            />
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>
              {c("لا توجد مهارة مطابقة", "No matching skill")}
            </ComboboxEmpty>
            <ComboboxList>
              {(key: string) => (
                <ComboboxItem key={key} value={key}>
                  <bdi>{label(key)}</bdi>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
      <Field>
        <FieldLabel>{c("التخصص", "Major")}</FieldLabel>
        <NativeSelect
          aria-label={c("التخصص", "Major")}
          value={value.major}
          onChange={(e) => onChange({ major: e.target.value })}
        >
          <option value="">{c("كل التخصصات", "All majors")}</option>
          {options.majors.map((major) => (
            <option key={major}>{major}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel>{c("المستوى", "Level")}</FieldLabel>
        <NativeSelect
          aria-label={c("المستوى", "Level")}
          value={value.level}
          onChange={(e) => onChange({ level: e.target.value })}
        >
          <option value="">{c("كل المستويات", "All levels")}</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {academicLevel(String(i + 1), en ? "en" : "ar")}
            </option>
          ))}
          <option value="graduate">
            {academicLevel("graduate", en ? "en" : "ar")}
          </option>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel>{c("أقل ساعات", "Minimum hours")}</FieldLabel>
        <Input
          type="number"
          min={0}
          max={100000}
          inputMode="numeric"
          aria-label={c("الحد الأدنى للساعات", "Minimum approved hours")}
          value={value.minHours || ""}
          placeholder="0"
          onChange={(e) =>
            onChange({
              minHours: Math.max(
                0,
                Math.min(100000, Number(e.target.value) || 0),
              ),
            })
          }
        />
      </Field>
      <Field>
        <FieldLabel>{c("الترتيب", "Sort")}</FieldLabel>
        <NativeSelect
          aria-label={c("الترتيب", "Sort")}
          value={value.sort}
          onChange={(e) =>
            onChange({ sort: e.target.value as TalentFilters["sort"] })
          }
        >
          <option value="relevance">{c("الأكثر صلة", "Relevance")}</option>
          <option value="hours">
            {c("الأكثر ساعات", "Most approved hours")}
          </option>
          <option value="name">{c("الاسم", "Name")}</option>
        </NativeSelect>
      </Field>
    </FieldGroup>
  );
}

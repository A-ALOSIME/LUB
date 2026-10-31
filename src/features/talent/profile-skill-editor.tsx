"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { ArrowUp, ArrowDown, Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { createTranslator, formatNumber } from "@/lib/i18n";
import type { Locale } from "@/lib/preferences";
import { skillName, type ProfileSkill } from "./profile-skills-model";
import {
  loadProfileSkills,
  saveProfileSkills,
  searchProfileSkillCatalog,
} from "./profile-skill-actions";

function SkillAction({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.ComponentProps<
  typeof Button
>) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label} {...props} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ProfileSkillEditor({
  open,
  onOpenChange,
  slug,
  currentSkills,
  onSkillsChange,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  currentSkills: ProfileSkill[];
  onSkillsChange: (skills: ProfileSkill[]) => void;
  locale: Locale;
}) {
  const c = useMemo(() => createTranslator(locale), [locale]),
    id = useId(),
    [draft, setDraft] = useState<ProfileSkill[]>([]),
    [loading, setLoading] = useState(true),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [remove, setRemove] = useState<ProfileSkill | null>(null),
    [query, setQuery] = useState(""),
    [suggestions, setSuggestions] = useState<ProfileSkill[]>([]),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    loadProfileSkills(slug)
      .then((result) => {
        if (!active) return;
        if (result.skills) {
          setDraft(result.skills);
          setLoaded(true);
        } else
          setError(
            c(
              "تعذّر تحميل المهارات. أغلق النافذة وحاول مجددًا.",
              "Could not load skills. Close the panel and try again.",
            ),
          );
      })
      .catch(() => {
        if (active)
          setError(
            c(
              "تعذّر تحميل المهارات. حاول مجددًا.",
              "Could not load skills. Try again.",
            ),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, slug, c]);
  useEffect(() => {
    let active = true;
    if (!open || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(false);
      searchProfileSkillCatalog(query)
        .then((rows) => {
          if (active) setSuggestions(rows);
        })
        .catch(() => {
          if (active) {
            setSuggestions([]);
            setSearchError(true);
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);
  const featuredCount = draft.filter((s) => s.featured).length;
  function move(index: number, offset: number) {
    setDraft((rows) => {
      const next = [...rows];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next.map((s, order) => ({ ...s, order }));
    });
  }
  async function save() {
    const before = currentSkills,
      next = draft.map((s, order) => ({ ...s, order }));
    setSaving(true);
    setError("");
    onSkillsChange(next);
    try {
      const result = await saveProfileSkills(
        slug,
        next.map(({ key, featured }) => ({ key, featured })),
      );
      if (!result.skills) throw new Error("save");
      onSkillsChange(result.skills);
      onOpenChange(false);
      toast.add({
        title: c("تم الحفظ", "Saved"),
        type: "success",
        timeout: 3000,
      });
    } catch {
      onSkillsChange(before);
      setError(
        c(
          "تعذّر حفظ المهارات. لم تُحفظ التغييرات؛ حاول مجددًا.",
          "Could not save skills. Your changes were not saved; try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  const choices = suggestions.filter(
    (s) => !draft.some((d) => d.key === s.key),
  );
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <SheetContent
        className="w-full sm:w-[min(90vw,32rem)]"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <SheetHeader>
          <SheetTitle>{c("تعديل المهارات", "Edit skills")}</SheetTitle>
          <SheetDescription>
            {c(
              "أضف حتى 30 مهارة، وحدّد حتى 5 مهارات مميزة. استخدم الأسهم لترتيبها.",
              "Add up to 30 skills and feature up to 5. Use the arrows to set their order.",
            )}
          </SheetDescription>
        </SheetHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            {c("جاري التحميل…", "Loading…")}
          </p>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor={id}>
                {c("إضافة من قاموس المهارات", "Add from the skill dictionary")}
              </FieldLabel>
              <Combobox
                items={choices.map((s) => s.key)}
                filter={null}
                value={null}
                inputValue={query}
                onInputValueChange={(value, details) => {
                  if (
                    details.reason === "input-change" ||
                    details.reason === "input-clear"
                  ) {
                    setQuery(value);
                    setSuggestions([]);
                    setSearchError(false);
                  }
                }}
                onValueChange={(key) => {
                  const skill = choices.find((s) => s.key === key);
                  if (skill && draft.length < 30) {
                    setDraft((rows) => [
                      ...rows,
                      { ...skill, order: rows.length },
                    ]);
                    setQuery("");
                    setSuggestions([]);
                  }
                }}
              >
                <ComboboxInput
                  id={id}
                  disabled={saving || draft.length >= 30}
                  showTrigger={false}
                  maxLength={80}
                  placeholder={c(
                    "ابحث بالعربية أو الإنجليزية…",
                    "Search in Arabic or English…",
                  )}
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {query.trim().length < 2
                      ? c(
                          "اكتب حرفين على الأقل",
                          "Type at least two characters",
                        )
                      : searching
                        ? c("جاري البحث…", "Searching…")
                        : searchError
                          ? c(
                              "تعذّر البحث. حاول مجددًا.",
                              "Search failed. Try again.",
                            )
                          : c("لا توجد مهارات مطابقة", "No matching skills")}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(key) => (
                      <ComboboxItem key={key} value={key}>
                        <bdi>
                          {skillName(
                            choices.find((s) => s.key === key)!,
                            locale,
                          )}
                        </bdi>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <FieldDescription>
                {c("المميزة", "Featured")}:{" "}
                {formatNumber(featuredCount, locale)} / 5 ·{" "}
                {c("المهارات", "Skills")}: {formatNumber(draft.length, locale)}{" "}
                / 30
              </FieldDescription>
            </Field>
            <ol className="flex flex-col divide-y divide-border">
              {draft.map((skill, index) => (
                <li
                  key={skill.key}
                  className="flex min-w-0 flex-col items-stretch gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <bdi
                    className="min-w-0 flex-1 truncate"
                    title={skillName(skill, locale)}
                  >
                    {skillName(skill, locale)}
                  </bdi>
                  <div className="flex shrink-0 items-center gap-1 self-end">
                    <SkillAction
                      label={c("تحريك لأعلى", "Move up")}
                      disabled={saving || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </SkillAction>
                    <SkillAction
                      label={c("تحريك لأسفل", "Move down")}
                      disabled={saving || index === draft.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </SkillAction>
                    <SkillAction
                      label={
                        skill.featured
                          ? c("إلغاء التمييز", "Unfeature skill")
                          : c("تمييز المهارة", "Feature skill")
                      }
                      aria-pressed={skill.featured}
                      disabled={
                        saving || (!skill.featured && featuredCount >= 5)
                      }
                      onClick={() =>
                        setDraft((rows) =>
                          rows.map((s) =>
                            s.key === skill.key
                              ? { ...s, featured: !s.featured }
                              : s,
                          ),
                        )
                      }
                    >
                      <Star className={skill.featured ? "fill-current" : ""} />
                    </SkillAction>
                    <SkillAction
                      label={c("حذف المهارة", "Remove skill")}
                      className="text-destructive"
                      disabled={saving}
                      onClick={() => setRemove(skill)}
                    >
                      <Trash2 />
                    </SkillAction>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        <SheetFooter className="sm:justify-start">
          <Button disabled={!loaded || loading || saving} onClick={save}>
            {saving ? c("جاري الحفظ…", "Saving…") : c("حفظ", "Save")}
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {c("إلغاء", "Cancel")}
          </Button>
        </SheetFooter>
        <AlertDialog
          open={!!remove}
          onOpenChange={(value) => {
            if (!value) setRemove(null);
          }}
        >
          <AlertDialogContent dir={locale === "ar" ? "rtl" : "ltr"}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {c("حذف مهارة", "Remove skill")}{" "}
                <bdi>{remove && skillName(remove, locale)}</bdi>
                {locale === "en" ? "?" : "؟"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {c(
                  "ستُزال من قائمة مهاراتك عند الحفظ، ولا يتغير سجل مشاركاتك.",
                  "This skill will be removed from your profile when you save. Your participation history stays unchanged.",
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setDraft((rows) => rows.filter((s) => s.key !== remove?.key));
                  setRemove(null);
                }}
              >
                {c("حذف", "Remove")}
              </AlertDialogAction>
              <AlertDialogCancel>{c("إلغاء", "Cancel")}</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

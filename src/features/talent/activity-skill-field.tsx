"use client";
import { useEffect, useId, useState } from "react";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/preferences";
import { skillName, type ProfileSkill } from "./profile-skills-model";
import { searchActivitySkills } from "./activity-skill-actions";

export function ActivitySkillField({
  initialSkills = [],
  locale = "ar",
  kind,
  className,
}: {
  initialSkills?: ProfileSkill[];
  locale?: Locale;
  kind: "Task" | "Event";
  className?: string;
}) {
  const c = createTranslator(locale),
    id = useId(),
    anchor = useComboboxAnchor();
  const [selected, setSelected] = useState(initialSkills),
    [known, setKnown] = useState(initialSkills),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<ProfileSkill[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      searchActivitySkills(query)
        .then((skills) => {
          if (active) {
            setResults(skills);
            setKnown((previous) => [
              ...new Map(
                [...previous, ...skills].map((skill) => [skill.key, skill]),
              ).values(),
            ]);
          }
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  const catalog = new Map(
    [...known, ...results, ...selected].map((skill) => [skill.key, skill]),
  );
  const label = (key: string) => {
    const skill = catalog.get(key);
    return skill ? skillName(skill, locale) : key;
  };
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>
        {c("المهارات المستخدمة (اختياري)", "Skills used (optional)")}
      </FieldLabel>
      <input type="hidden" name="skills-present" value="on" />
      {selected.map((skill) => (
        <input key={skill.key} type="hidden" name="skill" value={skill.key} />
      ))}
      <Combobox
        multiple
        items={[
          ...new Set([...results, ...selected].map((skill) => skill.key)),
        ]}
        filter={null}
        value={selected.map((skill) => skill.key)}
        inputValue={query}
        onInputValueChange={(value, details) => {
          if (
            details.reason === "input-change" ||
            details.reason === "input-clear"
          ) {
            setQuery(value);
            setResults([]);
            setError(false);
          }
        }}
        onValueChange={(keys) => {
          if (keys.length <= 30) {
            setSelected(keys.map((key) => catalog.get(key)!));
            setQuery("");
            setResults([]);
          }
        }}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(keys: string[]) =>
              keys.map((key) => (
                <ComboboxChip
                  key={key}
                  removeLabel={c(
                    `إزالة مهارة ${label(key)}`,
                    `Remove ${label(key)}`,
                  )}
                >
                  <bdi className="max-w-52 truncate">{label(key)}</bdi>
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput
            id={id}
            maxLength={80}
            disabled={selected.length >= 30}
            placeholder={c(
              "ابحث بالعربية أو الإنجليزية…",
              "Search in Arabic or English…",
            )}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>
            {query.trim().length < 2
              ? c(
                  "اكتب حرفين للبحث في القاموس",
                  "Type two characters to search the dictionary",
                )
              : loading
                ? c("جاري البحث…", "Searching…")
                : c("لا توجد مهارات مطابقة", "No matching skills")}
          </ComboboxEmpty>
          <ComboboxList>
            {(key) => (
              <ComboboxItem key={key} value={key}>
                <bdi>{label(key)}</bdi>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription>
        {kind === "Task"
          ? c(
              "تُحتسب كدليل في ملف العضو بعد اعتماد مشاركته في المهمة فقط.",
              "Counts as profile evidence only after the member’s task participation is approved.",
            )
          : c(
              "تُحتسب كدليل بعد اكتمال الفعالية وتوثيق حضور العضو أو مساهمته.",
              "Counts as profile evidence after the event is completed and the member’s attendance or contribution is verified.",
            )}
      </FieldDescription>
      {error && (
        <FieldError>
          {c(
            "تعذّر البحث عن المهارات. حاول مجددًا؛ اختياراتك محفوظة في النموذج.",
            "Could not search skills. Try again; your selections remain in the form.",
          )}
        </FieldError>
      )}
    </Field>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { formatCount } from "@/lib/display";
import { formatNumber, createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/preferences";
import {
  orderProfileSkills,
  skillName,
  type ProfileSkill,
} from "./profile-skills-model";
import { ProfileSkillEditor } from "./profile-skill-editor";

function SkillBadge({
  skill,
  locale,
  featured,
}: {
  skill: ProfileSkill;
  locale: Locale;
  featured: boolean;
}) {
  const c = createTranslator(locale),
    name = skillName(skill, locale),
    alternate = locale === "en" ? skill.labelAr : skill.labelEn;
  const evidence = [
    skill.tasks > 0 ? formatCount(skill.tasks, "tasks", locale) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={`h-auto max-w-full whitespace-normal gap-1.5 px-3 py-2 text-sm leading-relaxed hover:border-foreground/50 hover:bg-muted hover:text-foreground focus-visible:ring-2 ${featured ? "border-foreground/40" : ""}`}
            render={
              <Link
                aria-label={evidence ? `${name} · ${evidence}` : name}
                href={`/talent?skill=${encodeURIComponent(skill.filterValue)}`}
              />
            }
          />
        }
      >
        {featured && <Star aria-hidden="true" className="shrink-0" />}
        <bdi className="min-w-0 break-words [overflow-wrap:anywhere]">{name}</bdi>
        {evidence && <span className="shrink-0 text-xs"> · {evidence}</span>}
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <p>
          <bdi>{name}</bdi>
          {alternate !== name && (
            <>
              {" "}
              · <bdi>{alternate}</bdi>
            </>
          )}
        </p>
        {evidence && (
          <p>
            {c(
              "من مشاركات صاحب الملف المعتمدة في مهام ربطها القائد بهذه المهارة.",
              "Based on approved task participations tagged with this skill by the organization leader.",
            )}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function ProfileSkills({
  initialSkills,
  slug,
  owner = false,
  locale = "ar",
}: {
  initialSkills: ProfileSkill[];
  slug: string;
  owner?: boolean;
  locale?: Locale;
}) {
  const c = createTranslator(locale),
    [skills, setSkills] = useState(initialSkills),
    [editing, setEditing] = useState(false),
    [expanded, setExpanded] = useState(false);
  const sorted = orderProfileSkills(skills, locale),
    featured = sorted.filter((s) => s.featured);
  const remaining = sorted.filter(
      (s) => !featured.some((f) => f.key === s.key),
    ),
    visible = expanded ? remaining : remaining.slice(0, 6);
  const groups =
    skills.length > 6
      ? Array.from(new Set(visible.map((s) => s.category.key))).map((key) => ({
          category: visible.find((s) => s.category.key === key)!.category,
          skills: visible.filter((s) => s.category.key === key),
        }))
      : [{ category: null, skills: visible }];
  if (!skills.length && !owner) return null;
  return (
    <Card data-profile-skills="">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          {c("المهارات", "Skills")}
          <span className="text-sm font-normal text-muted-foreground">
            {formatNumber(skills.length, locale)}
          </span>
        </CardTitle>
        {owner && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            {c("تعديل المهارات", "Edit skills")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-5">
        {!skills.length ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              {c(
                "أضف مهاراتك لتظهر لأصحاب الجهات",
                "Add your skills so club and council leaders can discover you",
              )}
            </p>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Plus />
              {c("إضافة مهارة", "Add a skill")}
            </Button>
          </div>
        ) : (
          <>
            {featured.length>0&&<div className="flex min-w-0 flex-wrap gap-2" aria-label={c("المهارات المميزة","Featured skills")}>
                {featured.map((skill) => (
                  <SkillBadge
                    key={skill.key}
                    skill={skill}
                    locale={locale}
                    featured={true}
                  />
                ))}
            </div>}
            {groups.map(
              (group) =>
                group.skills.length > 0 && (
                  <section
                    key={group.category?.key ?? "all"}
                    className="flex flex-col gap-2"
                  >
                    {group.category && (
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {locale === "en"
                          ? group.category.labelEn
                          : group.category.labelAr}
                      </h3>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {group.skills.map((skill) => (
                        <SkillBadge
                          key={skill.key}
                          skill={skill}
                          locale={locale}
                          featured={false}
                        />
                      ))}
                    </div>
                  </section>
                ),
            )}
            {remaining.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                {expanded
                  ? c("عرض أقل", "Show less")
                  : c("عرض الكل", "Show all")}
              </Button>
            )}
          </>
        )}
      </CardContent>
      {owner && editing && (
        <ProfileSkillEditor
          open={editing}
          onOpenChange={setEditing}
          slug={slug}
          currentSkills={skills}
          onSkillsChange={setSkills}
          locale={locale}
        />
      )}
    </Card>
  );
}

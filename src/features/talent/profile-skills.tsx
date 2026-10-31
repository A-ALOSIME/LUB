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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
    skill.events > 0 ? formatCount(skill.events, "events", locale) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={`h-auto max-w-full gap-1.5 px-3 py-2 text-sm leading-relaxed hover:border-foreground/50 hover:bg-muted hover:text-foreground focus-visible:ring-2 ${featured ? "border-foreground/40" : ""}`}
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
        <bdi className="min-w-0 max-w-48 truncate">{name}</bdi>
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
              "من مهام اعتمدتها الجهة وفعاليات مكتملة بحضور أو مساهمة موثّقة في المنصة.",
              "Based on approved tasks and completed events with verified attendance or contributions on the platform.",
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
    hasFeatured = sorted.some((s) => s.featured),
    featured = hasFeatured
      ? sorted.filter((s) => s.featured)
      : sorted.slice(0, 5);
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
            <ScrollArea
              className="min-w-0"
              viewportProps={{
                "aria-label": c("المهارات المميزة", "Featured skills"),
              }}
            >
              <div className="flex w-max min-w-0 gap-2 pb-3">
                {featured.map((skill) => (
                  <SkillBadge
                    key={skill.key}
                    skill={skill}
                    locale={locale}
                    featured={true}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
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

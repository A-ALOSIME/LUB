"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MoreHorizontal,
  Pencil,
  UserRound,
  Power,
  Globe,
  Building2,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { OrganizationStatusBadge } from "./organization-status-badge";
import { AdminOrganizationDecision } from "./admin-organization-decision";
import type { AdminOrganizationRow } from "./management-repository";
import type { Locale } from "@/lib/preferences";
export function AdminOrganizationTable({
  organizations,
  locale,
}: {
  organizations: AdminOrganizationRow[];
  locale: Locale;
}) {
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    [decision, setDecision] = useState<{
      organization: AdminOrganizationRow;
      kind: "leader" | "status";
    } | null>(null);
  function status(item: AdminOrganizationRow) {
    return (
      <OrganizationStatusBadge
        status={
          item.statusCode === "Active"
            ? "active"
            : item.statusCode === "Archived"
              ? "archived"
              : "inactive"
        }
      >
        {item.statusCode === "Active"
          ? c("نشطة", "Active")
          : item.statusCode === "Archived"
            ? c("مؤرشفة", "Archived")
            : c("غير نشطة", "Inactive")}
      </OrganizationStatusBadge>
    );
  }
  function actions(item: AdminOrganizationRow) {
    return (
      <div className="inline-flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/manage/organizations/${item.id}/edit`} />}
        >
          {c("إدارة", "Manage")}
        </Button>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={c(
                      `إجراءات ${item.nameAr}`,
                      `${item.nameAr} actions`,
                    )}
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              {c("إجراءات الجهة", "Organization actions")}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={<Link href={`/manage/organizations/${item.id}/edit`} />}
            >
              <Pencil />
              {c("تعديل البيانات", "Edit details")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setDecision({ organization: item, kind: "leader" })
              }
            >
              <UserRound />
              {c("تغيير القائد", "Change leader")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setDecision({ organization: item, kind: "status" })
              }
            >
              <Power />
              {c("تغيير الحالة", "Change status")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href={`/organizations/${item.slug}`} />}
            >
              <Globe />
              {c("فتح الصفحة العامة", "Open public page")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
  function name(item: AdminOrganizationRow) {
    return (
      <span className="flex min-w-0 items-center gap-3">
        {item.logoUrl ? (
          <Image
            src={item.logoUrl}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 shrink-0 rounded-lg object-contain"
          />
        ) : (
          <Building2 className="size-8 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 break-words font-medium">{item.nameAr}</span>
      </span>
    );
  }
  if (!organizations.length)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <Building2 className="size-8 text-muted-foreground" />
          <p>{c("لا توجد جهات مطابقة.", "No matching organizations.")}</p>
        </CardContent>
      </Card>
    );
  return (
    <>
      <div className="hidden xl:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%]">
                {c("الجهة", "Organization")}
              </TableHead>
              <TableHead className="w-[10%]">{c("النوع", "Type")}</TableHead>
              <TableHead className="w-[12%]">{c("الحالة", "Status")}</TableHead>
              <TableHead className="w-[18%]">{c("القائد", "Leader")}</TableHead>
              <TableHead className="w-[8%]">
                {c("الأعضاء", "Members")}
              </TableHead>
              <TableHead className="w-[20%]">
                {c("الإجراءات", "Actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-sm whitespace-normal">
                  {name(item)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.typeCode === "Club"
                      ? c("نادي", "Club")
                      : c("مجلس", "Council")}
                  </Badge>
                </TableCell>
                <TableCell>{status(item)}</TableCell>
                <TableCell className="whitespace-normal">
                  {item.leaderName ?? c("بدون قائد", "No leader")}
                </TableCell>
                <TableCell>{item.memberCount}</TableCell>
                <TableCell>{actions(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-4 xl:hidden">
        {organizations.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-col gap-4">
              {name(item)}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {item.typeCode === "Club"
                    ? c("نادي", "Club")
                    : c("مجلس", "Council")}
                </Badge>
                {status(item)}
              </div>
              <p className="text-sm">
                {item.leaderName ?? c("بدون قائد", "No leader")} ·{" "}
                {c("الأعضاء:", "Members:")} <bdi>{item.memberCount}</bdi>
              </p>
              {actions(item)}
            </CardContent>
          </Card>
        ))}
      </div>
      {decision && (
        <AdminOrganizationDecision
          organization={decision.organization}
          kind={decision.kind}
          locale={locale}
          onClose={() => setDecision(null)}
        />
      )}
    </>
  );
}

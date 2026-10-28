"use client";
import { useState } from "react";
import Image from "next/image";
import { UserRound, UserRoundMinus, Power, Building2, Archive } from "lucide-react";
import { RowAction } from "@/components/row-action";
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
      kind: "leader" | "status" | "remove-leader" | "archive";
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
            : c("موقوفة", "Inactive")}
      </OrganizationStatusBadge>
    );
  }
  function leader(item: AdminOrganizationRow) {
    return item.leaderName ?? <Button variant="outline" size="sm" onClick={() => setDecision({organization:item,kind:"leader"})}>{c("تعيين قائد","Assign leader")}</Button>;
  }
  function actions(item: AdminOrganizationRow) {
    return <div className="inline-flex flex-wrap items-center gap-2">
      <RowAction label={item.leaderName ? c("تغيير القائد","Change leader") : c("تعيين قائد","Assign leader")} onClick={()=>setDecision({organization:item,kind:"leader"})}><UserRound /></RowAction>
      <RowAction label={item.statusCode === "Active" ? c("إيقاف الجهة","Deactivate organization") : c("تفعيل الجهة","Activate organization")} onClick={()=>setDecision({organization:item,kind:"status"})}><Power /></RowAction>
      <RowAction label={c("أرشفة الجهة","Archive organization")} disabled={item.statusCode==="Archived"} onClick={()=>setDecision({organization:item,kind:"archive"})}><Archive /></RowAction>
      <RowAction label={c("حذف القائد","Remove leader")} danger disabled={!item.leaderName} onClick={()=>setDecision({organization:item,kind:"remove-leader"})}><UserRoundMinus /></RowAction>
    </div>;
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
        <Table className="table-fixed [&_td]:py-5">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">
                {c("الجهة", "Organization")}
              </TableHead>
              <TableHead className="w-[10%]">{c("النوع", "Type")}</TableHead>
              <TableHead className="w-[12%]">{c("الحالة", "Status")}</TableHead>
              <TableHead className="w-[18%]">{c("القائد", "Leader")}</TableHead>
              <TableHead className="w-[8%]">
                {c("عدد الأعضاء", "Members")}
              </TableHead>
              <TableHead className="w-[18%]">
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
                  {leader(item)}
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
                {leader(item)} ·{" "}
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

import type { ComponentType, ReactNode } from "react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "cn";

export function WorkspaceEmptyState({ icon: Icon, title, description, action, actionClassName }: {
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
  actionClassName?: string;
}) {
  return <Empty role="status" className="workspace-empty-state">
    <EmptyHeader className="workspace-empty-state-header">
      <EmptyMedia variant="icon" className="workspace-empty-state-icon size-11 rounded-xl border border-border/70 bg-background text-primary"><Icon aria-hidden={true} className="size-5" /></EmptyMedia>
      <EmptyTitle role="heading" aria-level={2}>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action && <EmptyContent className={cn("workspace-empty-state-actions", actionClassName)}>{action}</EmptyContent>}
  </Empty>;
}

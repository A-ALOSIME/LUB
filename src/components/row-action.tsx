"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {useI18n} from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function RowAction({
  label,
  hint,
  children,
  danger = false,
  href,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string;
  hint?: string;
  children: ReactNode;
  danger?: boolean;
  href?: string;
}) {
  const {t}=useI18n();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex min-w-0 max-w-full"
            tabIndex={props.disabled ? 0 : undefined}
          />
        }
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          {...props}
          onClick={event=>{event.stopPropagation();props.onClick?.(event);}}
          onKeyDown={event=>{event.stopPropagation();props.onKeyDown?.(event);}}
          aria-label={label}
          className={cn(
            "row-action min-w-0 max-w-full whitespace-normal",
            danger && "row-action--danger",
            className,
          )}
          {...(href
            ? {
                render: <Link href={href} />,
                nativeButton: false,
                role: "link",
              }
            : {})}
        >
          {children}
          <span className="row-action-label">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{props.disabled?(hint??t("غير متاح للحالة الحالية أو لصلاحياتك","Unavailable for this status or your permissions")):label}</TooltipContent>
    </Tooltip>
  );
}

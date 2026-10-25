"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex"
            tabIndex={props.disabled ? 0 : undefined}
          />
        }
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          {...props}
          aria-label={label}
          className={cn(
            "row-action",
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
      <TooltipContent>{hint ?? label}</TooltipContent>
    </Tooltip>
  );
}

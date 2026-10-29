"use client";

import {formatNumber} from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "cn";

export type FilterTabOption = {
  value: string;
  label: string;
  count?: number;
};

export function FilterTabs({
  value,
  options,
  ariaLabel,
  dir = "rtl",
  size = "sm",
  activeTone = "primary",
  className,
  onValueChange,
  onItemClick,
}: {
  value: string;
  options: FilterTabOption[];
  ariaLabel: string;
  dir?: "ltr" | "rtl";
  size?: "sm" | "default" | "lg";
  activeTone?: "secondary" | "primary";
  className?: string;
  onValueChange: (value: string) => void;
  onItemClick?: (value: string) => void;
}) {
  const compact = size === "sm";

  return <Tabs
    value={value}
    dir={dir}
    onValueChange={next => { if (next) onValueChange(next); }}
    className="min-w-0 gap-0"
  >
    <div dir={dir} className="workspace-filter-scroll">
      <TabsList aria-label={ariaLabel} className={cn("workspace-segmented-control workspace-filter-control", className)}>
        {options.map(option => {
          const active = value === option.value;
          const activeColors = activeTone === "primary"
            ? "data-active:bg-primary data-active:text-primary-foreground"
            : "data-active:bg-secondary data-active:text-secondary-foreground";

          return <TabsTrigger
            key={option.value}
            value={option.value}
            onClick={() => onItemClick?.(option.value)}
            className={cn(
              "w-fit flex-none rounded-md border-transparent shadow-none",
              compact ? "h-7 px-2.5 text-xs" : size === "lg" ? "h-10 px-4" : "h-9 px-3",
              activeColors,
              active && "border-transparent shadow-none"
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined && <Badge
              variant="outline"
              className={cn(
                "h-5 min-w-5 justify-center px-1.5 text-[0.7rem] leading-none",
                active && activeTone === "primary" && "border-transparent bg-primary-foreground/15 text-primary-foreground",
                active && activeTone === "secondary" && "border-transparent bg-secondary-foreground/10 text-secondary-foreground"
              )}
            >
              {formatNumber(option.count,dir==="ltr"?"en":"ar")}
            </Badge>}
          </TabsTrigger>;
        })}
      </TabsList>
    </div>
  </Tabs>;
}

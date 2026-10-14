"use client";

import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "cn";

export type FilterToggleOption = {
  value: string;
  label: string;
  count?: number;
};

export function FilterToggleGroup({
  value,
  options,
  ariaLabel,
  dir = "rtl",
  size = "sm",
  activeTone = "secondary",
  className,
  onValueChange,
  onItemClick,
}: {
  value: string;
  options: FilterToggleOption[];
  ariaLabel: string;
  dir?: "ltr" | "rtl";
  size?: "sm" | "default" | "lg";
  activeTone?: "secondary" | "primary";
  className?: string;
  onValueChange: (value: string) => void;
  onItemClick?: (value: string) => void;
}) {
  return <ToggleGroup
    multiple={false}
    value={[value]}
    onValueChange={values => {
      const next = values[0];
      if (next) onValueChange(next);
    }}
    aria-label={ariaLabel}
    dir={dir}
    variant="outline"
    size={size}
    spacing={1}
    className={cn("max-w-full flex-wrap", className)}
  >
    {options.map(option => {
      const active = value === option.value;
      return <ToggleGroupItem
        key={option.value}
        value={option.value}
        onClick={() => onItemClick?.(option.value)}
        className={cn(
          "text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-secondary-foreground aria-pressed:hover:bg-secondary",
          activeTone === "primary" && "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary"
        )}
      >
        <span>{option.label}</span>
        {option.count !== undefined && <Badge variant={active ? "secondary" : "outline"} className="h-5 min-w-5 justify-center px-1.5 text-[0.7rem] leading-none">
          {new Intl.NumberFormat("en-US").format(option.count)}
        </Badge>}
      </ToggleGroupItem>;
    })}
  </ToggleGroup>;
}

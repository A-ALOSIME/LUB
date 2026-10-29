import {formatNumber} from "@/lib/i18n";
import type { Locale } from "@/lib/preferences";
import { formatRiyadhDate } from "@/lib/datetime";

export function formatPersonalDate(value: string, locale: Locale) {
  return formatRiyadhDate(value, locale);
}

export function formatPersonalNumber(value: number | string, locale: Locale) {
  return formatNumber(value,locale);
}

import "server-only";
import { translateContent } from "./content-translation";

/** Fallback to saved editorial text when no authored English value is available. */
export function translatePublicContent(source: string) {
  return translateContent(source, "en");
}

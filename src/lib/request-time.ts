import "server-only";
import {cache} from "react";
// Capture one request-scoped clock snapshot for SSR and its client hydration.
export const requestTime=cache(()=>Date.now());

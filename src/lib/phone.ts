import { normalizeDigits } from "./validation";

// Calling codes are independent of the surrounding document's writing direction.
export const callingCodes = "1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 211 212 213 216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 240 241 242 243 244 245 246 247 248 249 250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 290 291 297 298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 504 505 506 507 508 509 590 591 592 593 594 595 596 597 598 599 670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 850 852 853 855 856 880 886 960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 992 993 994 995 996 998".split(" ");

export function phoneDigits(value: string) {
  return normalizeDigits(value).replace(/[^0-9]/g, "");
}

export function splitPhone(value: string) {
  const normalized = normalizeDigits(value).trim().replace(/^tel:/i, "");
  const digits = phoneDigits(normalized).replace(normalized.startsWith("00") ? /^00/ : /$^/, "");
  const international = normalized.startsWith("+") || normalized.startsWith("00") || digits.startsWith("966") && digits.length > 10;
  const code = international ? [...callingCodes].sort((a, b) => b.length - a.length).find(code => digits.startsWith(code)) ?? digits.slice(0, 3) : undefined;
  return { code: code ?? "966", number: code ? digits.slice(code.length) : digits };
}

export function joinPhone(code: string, number: string) {
  const digits = phoneDigits(number);
  return digits ? `+${code}${code === "966" ? digits.replace(/^0+/, "") : digits}` : "";
}

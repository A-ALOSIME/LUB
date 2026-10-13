"use client";

import { useEffect, useRef, useState } from "react";

function parseStatValue(value: string) {
  const match = /^(\+?)([\d,]+)(.*)$/.exec(value);
  if (!match) return null;

  return {
    prefix: match[1],
    target: Number(match[2].replaceAll(",", "")),
    suffix: match[3],
  };
}

function formatStatValue(value: number, prefix: string, suffix: string) {
  return `${prefix}${value.toLocaleString("en-US")}${suffix}`;
}

export function AnimatedStat({ value }: { value: string }) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const parsed = parseStatValue(value);
    const element = elementRef.current;

    if (!parsed || !element || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;

      observer.disconnect();
      setDisplayValue(formatStatValue(0, parsed.prefix, parsed.suffix));
      const start = performance.now();
      let lastUpdate = start;

      const animate = (now: number) => {
        if (now - lastUpdate >= 32 || now - start >= 900) {
          const progress = Math.min((now - start) / 900, 1);
          const eased = 1 - (1 - progress) ** 3;
          setDisplayValue(formatStatValue(Math.round(parsed.target * eased), parsed.prefix, parsed.suffix));
          lastUpdate = now;
        }

        if (now - start < 900) frame = requestAnimationFrame(animate);
        else setDisplayValue(value);
      };

      frame = requestAnimationFrame(animate);
    }, { threshold: 0.4 });

    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={elementRef} aria-label={value}><span aria-hidden="true">{displayValue}</span></span>;
}

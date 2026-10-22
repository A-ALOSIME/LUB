"use client";

import Link from "next/link";
import { useState } from "react";

type Props = Omit<React.ComponentProps<typeof Link>, "prefetch">;

export function IntentPrefetchLink(props: Props) {
  const [prefetch, setPrefetch] = useState(false);
  const startPrefetch = () => setPrefetch(true);

  return <Link
    {...props}
    prefetch={prefetch ? true : false}
    onMouseEnter={event => { props.onMouseEnter?.(event); startPrefetch(); }}
    onFocus={event => { props.onFocus?.(event); startPrefetch(); }}
    onTouchStart={event => { props.onTouchStart?.(event); startPrefetch(); }}
  />;
}

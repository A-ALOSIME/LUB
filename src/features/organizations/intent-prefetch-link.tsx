"use client";

import Link from "next/link";
import { useState } from "react";

type Props = Omit<React.ComponentProps<typeof Link>, "prefetch"> & {preload?:()=>void; shell?:boolean};

export function IntentPrefetchLink({preload,shell=false,...props}: Props) {
  const [prefetch, setPrefetch] = useState(false);
  const startPrefetch = () => {
    setPrefetch(true);
    preload?.();
  };

  return <Link
    {...props}
    prefetch={prefetch ? true : shell ? null : false}
    onMouseEnter={event => { props.onMouseEnter?.(event); startPrefetch(); }}
    onFocus={event => { props.onFocus?.(event); startPrefetch(); }}
    onTouchStart={event => { props.onTouchStart?.(event); startPrefetch(); }}
  />;
}

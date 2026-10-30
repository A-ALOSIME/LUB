"use client";

import {Avatar,AvatarFallback,AvatarImage} from "@/components/ui/avatar";
import {cn} from "cn";
import type {ComponentProps} from "react";

/** Organization marks use a square frame; person avatars keep their circular defaults. */
export function OrganizationLogo({name,src,className,...props}:{name:string;src?:string|null}&ComponentProps<typeof Avatar>){
 return <Avatar {...props} className={cn("organization-logo rounded-lg after:rounded-lg",className)} aria-label={name}>
  <AvatarImage keepMounted src={src?.trim()||undefined} alt={name} style={state=>({display:state.imageLoadingStatus==="loaded"?undefined:"none"})} className="rounded-lg object-contain p-0 data-[loading]:hidden data-[error]:hidden"/>
  <AvatarFallback className="rounded-lg" dir="auto">{Array.from(name.trim())[0]??""}</AvatarFallback>
 </Avatar>;
}

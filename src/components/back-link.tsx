import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import type {ReactNode} from "react";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";

export function BackLink({href,children,className}:{href:string;children:ReactNode;className?:string}){
 return <Button variant="ghost" size="sm" className={cn("self-start",className)} nativeButton={false} role="link" render={<Link href={href}/>}><ArrowLeft className="rtl:rotate-180"/>{children}</Button>;
}

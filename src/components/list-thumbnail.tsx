import Image from "next/image";
import type {LucideIcon} from "lucide-react";
export function ListThumbnail({src,icon:Icon}:{src?:string|null;icon:LucideIcon}){
 return <span className="relative grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">{src?<Image src={src} alt="" fill unoptimized loading="lazy" sizes="80px" className="object-contain"/>:<Icon aria-hidden="true" className="text-muted-foreground"/>}</span>;
}

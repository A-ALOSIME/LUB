"use client";
import {Mail,Phone} from "lucide-react";
import {SiX} from "react-icons/si";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipTrigger,TooltipContent,TooltipProvider} from "@/components/ui/tooltip";
import {toast} from "@/components/ui/toast";
import {useIsMobile} from "@/hooks/use-mobile";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
export function FooterContactIcons({contacts,locale}:{contacts:{x:string;email:string;phone:string};locale:Locale}){
 const c=createTranslator(locale),mobile=useIsMobile(),phone=contacts.phone.replace(/^\+966/,'0');
 const items=[...(contacts.x?[{key:'x',label:'X',href:contacts.x,icon:SiX}]:[]),...(contacts.email?[{key:'email',label:c('البريد الإلكتروني','Email'),href:`mailto:${contacts.email}`,icon:Mail}]:[])];
 return <TooltipProvider><div className="flex items-center gap-2">{items.map(({key,label,href,icon:Icon})=><Tooltip key={key}><TooltipTrigger render={<Button variant="ghost" size="icon" nativeButton={false} role="link" render={<a href={href} target={key==='x'?'_blank':undefined} rel={key==='x'?'noopener noreferrer':undefined} aria-label={label}/>}/>}><Icon/></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}{contacts.phone&&<Tooltip><TooltipTrigger render={mobile?<Button variant="ghost" size="icon" nativeButton={false} role="link" render={<a href={`tel:${contacts.phone}`} aria-label={c(`اتصال: ${phone}`,`Call: ${phone}`)}/>}/>:<Button variant="ghost" size="icon" aria-label={c(`نسخ رقم الهاتف: ${phone}`,`Copy phone number: ${phone}`)} onClick={async()=>{try{await navigator.clipboard.writeText(phone);toast.add({title:c('تم نسخ الرقم','Phone number copied'),type:'success',timeout:3000});}catch{toast.add({title:c('تعذّر نسخ الرقم','Could not copy phone number'),type:'error',timeout:0});}}}/>}><Phone/></TooltipTrigger><TooltipContent><bdi>{phone}</bdi></TooltipContent></Tooltip>}</div></TooltipProvider>;
}

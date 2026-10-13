import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {notFound} from "next/navigation";
import {PublicHeader} from "@/components/public-header";
import {publicKnowledge} from "@/features/ai/knowledge";
import {getPreferences} from "@/lib/preferences";
import {toMetaDescription} from "@/lib/seo";
export async function generateMetadata({params}:{params:Promise<{topic:string}>}){
 const {topic}=await params;
 const doc=publicKnowledge.find(source=>source.id===topic);
 if(!doc)return localizedMetadata('صفحة غير موجودة','Page not found');
 const description=toMetaDescription(doc.text,doc.title);
 return localizedMetadata(doc.title,doc.title,{}, {index:true,canonical:`/help/${doc.id}`,description:{ar:description,en:description}});
}
export default async function HelpPage({params}:{params:Promise<{topic:string}>}){const [{topic},{locale}]=await Promise.all([params,getPreferences()]);const doc=publicKnowledge.find(s=>s.id===topic);if(!doc)notFound();return <><PublicHeader/><main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:px-8"><Link href="/ai" className="text-link">{locale==="en"?"Ask LUB":"اسأل لُبّ"}</Link><article className="panel mt-6 p-6 sm:p-8"><h1 dir="auto" className="text-2xl font-bold leading-normal">{doc.title}</h1><p dir="auto" className="mt-6 leading-9">{doc.text}</p></article></main></>;}

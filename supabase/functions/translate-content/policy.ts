import {SaxesParser} from "saxes";
import {englishOrganizationNames,englishOrganizationName} from "../../../src/lib/organization-names.ts";

export const MAX_TRANSLATION_CHARACTERS = 10000;
const aliases=Object.keys(englishOrganizationNames).sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
const names = new RegExp(`${aliases}|(?:(?<![\\p{L}\\p{M}])|(?<=و))(?:ل[\\p{M}ـ]*ب[\\p{M}ـ]*|(?:ال)?[إا]نجاز|تكنيشن|ظهير|طويق)(?![\\p{L}\\p{M}])`,"gu");
function englishName(name:string){
 const normalized=name.replace(/[\p{M}ـ]/gu,"").replace(/^ال/,"");
 return englishOrganizationNames[name]??({لب:"LUB",إنجاز:"Enjaz",انجاز:"Enjaz",تكنيشن:"TechNation",ظهير:"Dhaheer",طويق:"Tuwaiq"} as Record<string,string>)[normalized]??name;
}
/** Also normalizes translations cached before the English-name policy changed. */
export function normalizeEnglishNames(source:string,translated:string){return englishOrganizationName(source)??translated.replace(names,englishName);}
const escapeXml = (value:string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

/** XML ignore tags preserve one consistent Latin name instead of mixed-script names. */
export function protectNames(source:string) {
 let end=0;
 const parts:string[]=[];
 for(const match of source.matchAll(names)) {
  parts.push(escapeXml(source.slice(end,match.index)),`<keep>${escapeXml(englishName(match[0]))}</keep>`);
  end=match.index+match[0].length;
 }
 parts.push(escapeXml(source.slice(end)));
 return `<text>${parts.join("")}</text>`;
}

export function readTranslationXml(xml:string,source:string) {
 const parser=new SaxesParser(),parts:string[]=[];
 parser.on("doctype",()=>{throw Error("Unexpected document type");});
 parser.on("opentag",tag=>{if(!["text","keep"].includes(tag.name))throw Error("Unexpected translation tag");});
 parser.on("text",text=>parts.push(text));
 parser.on("cdata",text=>parts.push(text));
 parser.write(xml).close();
 const result=parts.join("");
 if(!result.trim()||result.length>30000)throw Error("Invalid translation");
 const expected=new Map<string,number>();for(const match of source.matchAll(names)){const name=englishName(match[0]);expected.set(name,(expected.get(name)??0)+1);}
 for(const [name,count] of expected)if(result.split(name).length-1<count)throw Error("A protected name changed");
 return result;
}

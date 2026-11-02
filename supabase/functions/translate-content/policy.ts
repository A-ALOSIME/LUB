import {SaxesParser} from "saxes";

export const MAX_TRANSLATION_CHARACTERS = 10000;
const names = /(?:(?<![\p{L}\p{M}])|(?<=و))(?:ل[\p{M}ـ]*ب[\p{M}ـ]*|(?:ال)?[إا]نجاز|تكنيشن)(?![\p{L}\p{M}])/gu;
const escapeXml = (value:string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

/** XML ignore tags preserve the original spelling, including the brand's marks. */
export function protectNames(source:string) {
 let end=0;
 const parts:string[]=[];
 for(const match of source.matchAll(names)) {
  parts.push(escapeXml(source.slice(end,match.index)),`<keep>${escapeXml(match[0])}</keep>`);
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
 for(const match of source.matchAll(names))if(result.split(match[0]).length!==source.split(match[0]).length)throw Error("A protected name changed");
 return result;
}

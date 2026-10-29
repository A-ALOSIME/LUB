import type {Locale} from "./preferences";
const formatters={ar:new Intl.NumberFormat("ar-SA-u-nu-arab",{maximumFractionDigits:2}),en:new Intl.NumberFormat("en-US",{maximumFractionDigits:2})};
export function formatNumber(value:number|string,locale:Locale="ar"){return formatters[locale].format(Number(value));}
export function localizeDigits(value:string,locale:Locale){return locale==="ar"?value.replace(/[0-9]/g,d=>"٠١٢٣٤٥٦٧٨٩"[Number(d)]):value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));}
export function t(locale:Locale,ar:string,en:string){return locale==="en"?en:localizeDigits(ar,locale);}
export function createTranslator(locale:Locale){return (ar:string,en:string)=>t(locale,ar,en);}

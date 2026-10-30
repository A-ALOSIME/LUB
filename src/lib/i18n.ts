import {translateOrganizationNames} from "./organization-names";
import type {Locale} from "./preferences";
const formatters={ar:new Intl.NumberFormat("en-US",{maximumFractionDigits:2}),en:new Intl.NumberFormat("en-US",{maximumFractionDigits:2})};
export function formatNumber(value:number|string,locale:Locale="ar"){return formatters[locale].format(Number(value));}
export function localizeDigits(value:string){return value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));}
export function t(locale:Locale,ar:string,en:string){return localizeDigits(locale==="en"?translateOrganizationNames(en):ar);}
export function createTranslator(locale:Locale){return (ar:string,en:string)=>t(locale,ar,en);}

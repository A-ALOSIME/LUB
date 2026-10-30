import {translateOrganizationNames} from "./organization-names";
import type {Locale} from "./preferences";
import english from "./content-english.json";

const saved=new Map(Object.entries(english).map(([source,translation])=>[source.normalize("NFC").replace(/\s+/g," ").trim(),translation]));
/** Saved editorial translations only: no paid service, mutation, or network request. Unknown authored text is preserved. */
export function translateContent(value:string,locale:Locale):string{
 if(locale!=="en"||!/[\u0621-\u064a]/u.test(value))return value;
 const key=value.normalize("NFC").replace(/\s+/g," ").trim();
 return saved.get(key)??translateOrganizationNames(value);
}

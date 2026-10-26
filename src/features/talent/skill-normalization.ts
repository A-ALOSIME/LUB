const aliases: Record<string, string> = {"بايثون":"python","اس كيو ال":"sql","جافاسكريبت":"javascript","جافا سكريبت":"javascript","تايب سكريبت":"typescript","رياكت":"react","فيجما":"figma"};
const labels:Record<string,string>={python:"Python",sql:"SQL",javascript:"JavaScript",typescript:"TypeScript",react:"React",figma:"Figma"};
export function arabicSearchKey(value:string){return value.toLowerCase().replace(/[ـًٌٍَُِّْٰٕٔ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه");}
export function skillKey(value:string){const key=arabicSearchKey(value.trim());return aliases[key]??key;}
export function skillLabel(value:string){return labels[skillKey(value)]??value.trim();}
export function displaySkills(values:string[]){return [...new Map(values.map(value=>[skillKey(value),skillLabel(value)])).values()];}

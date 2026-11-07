const arLevels=["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","الحادي عشر","الثاني عشر"];
const enLevels=["First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth","Eleventh","Twelfth"];
export function exportAcademicLevel(value:string,en:boolean){const stripped=value.replace(/^المستوى\s*|^Level\s*/iu,"");if(stripped==="graduate")return en?"Graduate":"خريج";const index=/^\d+$/.test(stripped)?Number(stripped)-1:arLevels.indexOf(stripped);return index>=0&&index<12?(en?enLevels:arLevels)[index]:stripped;}
export function localPhone(value:string|null){if(!value)return "";const digits=value.replace(/\D/g,"");return /^(?:00966|966)5\d{8}$/.test(digits)?`0${digits.slice(-9)}`:digits;}

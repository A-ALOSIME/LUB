import ExcelJS from "exceljs";
import {decryptExportIdentifier} from "./csv.ts";
import type {EncryptedMemberRecord} from "../../../src/features/organizations/member-types.ts";
export type MemberExportRecord=Pick<EncryptedMemberRecord,"userId"|"universityCiphertext"|"nationalCiphertext"|"name"|"major"|"level"|"status"|"email"|"phone"|"hours"|"startDate"|"roles"|"committees">&{isTest:boolean};
const arLevels=["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر","الحادي عشر","الثاني عشر"];
const enLevels=["First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth","Eleventh","Twelfth"];
export function exportAcademicLevel(value:string,en:boolean){const stripped=value.replace(/^المستوى\s*|^Level\s*/iu,"");const index=/^\d+$/.test(stripped)?Number(stripped)-1:arLevels.indexOf(stripped);return index>=0&&index<12?(en?enLevels:arLevels)[index]:stripped;}
export function localPhone(value:string|null){if(!value)return "";const digits=value.replace(/\D/g,"");return /^(?:00966|966)5\d{8}$/.test(digits)?`0${digits.slice(-9)}`:digits;}
export function exportFilename(slug:string,filter:string,now=new Date()){const safe=(value:string)=>value.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");const date=new Intl.DateTimeFormat("en-CA-u-nu-latn",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);return `${safe(slug)||"organization"}-${safe(filter)||"all"}-${date}.xlsx`;}
export async function membersXlsx(records:MemberExportRecord[],secret:string,locale:"ar"|"en"){
 const key=await crypto.subtle.importKey("raw",Uint8Array.from(atob(secret),c=>c.charCodeAt(0)),"AES-GCM",false,["decrypt"]),en=locale==="en";
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet(en?"Members":"الأعضاء",{views:[{state:"frozen",ySplit:1,rightToLeft:!en}]});
 const headers=en?["Name","University ID","National or residency ID","Phone","Email","Major","Academic level","Role","Committees","Join date","Approved hours","Status"]:["الاسم","الرقم الجامعي","رقم الهوية أو الإقامة","الجوال","الإيميل","التخصص","المستوى الدراسي","الدور","اللجان","تاريخ الانضمام","الساعات المعتمدة","الحالة"];
 sheet.addRow(headers).font={bold:true};
 const roles=en?{OL:"Organization leader",OD:"Deputy leader",CL:"Committee leader",HRL:"HR lead",HRD:"HR deputy",CD:"Committee deputy"}:{OL:"قائد الجهة",OD:"نائب القائد",CL:"قائد لجنة",HRL:"قائد الموارد البشرية",HRD:"نائب الموارد البشرية",CD:"نائب لجنة"};
 const states:Record<string,string>=en?{Active:"Active",Ended:"Ended",Inactive:"Inactive"}:{Active:"نشطة",Ended:"منتهية",Inactive:"غير نشطة"};
 const seen=new Set<string>();
 for(const record of records){if(record.isTest!==false)continue;if(seen.has(record.userId))throw new Error("Expected one row per member");seen.add(record.userId);const university=await decryptExportIdentifier(record.universityCiphertext,record.userId,"university-id",key),national=record.nationalCiphertext?await decryptExportIdentifier(record.nationalCiphertext,record.userId,"national-id",key):"";
 const role=(["OL","OD","HRL","CL","HRD","CD"] as const).find(code=>record.roles.some(r=>r.code===code));
 const values=[record.name,university,national,localPhone(record.phone),record.email,record.major,exportAcademicLevel(record.level,en),role?roles[role]:en?"Member":"عضو",[...new Set(record.committees.map(c=>c.name.replace(/[\r\n]+/g," ")))].join("، "),record.startDate?new Date(`${record.startDate.slice(0,10)}T00:00:00Z`):null,Math.round(Number(record.hours)),states[record.status]??record.status];
 const row=sheet.addRow(values.map(value=>typeof value==="string"?value||null:value));
 row.getCell(10).numFmt="yyyy-mm-dd";row.getCell(11).numFmt="0";
 // Values are real string cells, never formula objects. No apostrophe prefix is necessary in XLSX.
 for(const index of [2,3,4])row.getCell(index).numFmt="@";
 }
 sheet.eachRow(row=>row.eachCell({includeEmpty:true},cell=>{cell.alignment={horizontal:"right",vertical:"middle",wrapText:false};}));
 sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:12}};
 sheet.columns.forEach(column=>{let width=10;column.eachCell?.({includeEmpty:false},cell=>{width=Math.max(width,cell.value instanceof Date?12:String(cell.value??"").length+2);});column.width=Math.min(width,50);});
 return new Uint8Array(await workbook.xlsx.writeBuffer());
}

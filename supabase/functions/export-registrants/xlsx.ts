import ExcelJS from "exceljs";
import {decryptExportIdentifier} from "../export-members/csv.ts";
import {localPhone,exportAcademicLevel} from "../export-members/xlsx.ts";
export type RegistrantExportRecord={userId:string;isTest:boolean;name:string;universityCiphertext:string|null;nationalCiphertext:string|null;phone:string|null;email:string;major:string;level:string;registeredDate:string|null;status:string;hours:number|string};
export type RegistrantsExport={slug:string;eventId:string;eventTitle:string;records:RegistrantExportRecord[]};
export async function registrantsWorkbook(data:RegistrantsExport,locale:"ar"|"en",secret:string){
 const key=await crypto.subtle.importKey("raw",Uint8Array.from(atob(secret),c=>c.charCodeAt(0)),"AES-GCM",false,["decrypt"]),book=new ExcelJS.Workbook(),en=locale==="en";
 book.subject=data.eventTitle;const sheet=book.addWorksheet(en?"Event registrants":"المسجلون",{views:[{state:"frozen",ySplit:1,rightToLeft:!en}]});
 sheet.addRow(en?["Name","University ID","National or residency ID","Phone","Email","Major","Academic level","Registration date","Status","Event hours"]:["الاسم","الرقم الجامعي","رقم الهوية أو الإقامة","الجوال","الإيميل","التخصص","المستوى الدراسي","تاريخ التسجيل","الحالة","ساعات الفعالية"]).font={bold:true};
 const seen=new Set<string>();
 for(const record of data.records){
  if(record.isTest!==false||!["Accepted","Recorded"].includes(record.status))continue;
  if(seen.has(record.userId))throw new Error("Expected one registrant per event");seen.add(record.userId);
  const university=record.universityCiphertext?await decryptExportIdentifier(record.universityCiphertext,record.userId,"university-id",key):null,national=record.nationalCiphertext?await decryptExportIdentifier(record.nationalCiphertext,record.userId,"national-id",key):null;
  const row=sheet.addRow([record.name,university,national,localPhone(record.phone)||null,record.email||null,record.major||null,exportAcademicLevel(record.level,en)||null,record.registeredDate?new Date(`${record.registeredDate.slice(0,10)}T00:00:00Z`):null,record.status==="Recorded"?(en?"Recorded":"مرصودة"):(en?"Accepted":"مقبول"),Math.round(Number(record.hours))]);
  for(const index of [2,3,4])row.getCell(index).numFmt="@";row.getCell(8).numFmt="yyyy-mm-dd";row.getCell(10).numFmt="0";
 }
 sheet.eachRow(row=>row.eachCell({includeEmpty:true},cell=>{cell.alignment={horizontal:"right",vertical:"middle",wrapText:false};}));
 sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:10}};
 sheet.columns.forEach(column=>{let width=12;column.eachCell?.({includeEmpty:false},cell=>{width=Math.max(width,cell.value instanceof Date?12:Math.min(String(cell.value??"").length+2,48));});column.width=width;});
 return new Uint8Array(await book.xlsx.writeBuffer());
}

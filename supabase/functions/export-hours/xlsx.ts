import ExcelJS from "exceljs";
import {decryptExportIdentifier} from "../export-members/csv.ts";

export type HoursExport={organization:string;slug:string;period?:string;state?:string|null;records:Array<{userId:string;name:string;universityCiphertext:string|null;hours:string;firstDate:string|null;lastDate:string|null;isTest:boolean}>};
export async function hoursWorkbook(data:HoursExport,locale:"ar"|"en",secret:string){
 const key=await crypto.subtle.importKey("raw",Uint8Array.from(atob(secret),c=>c.charCodeAt(0)),"AES-GCM",false,["decrypt"]);
 const c=(ar:string,en:string)=>locale==="ar"?ar:en,book=new ExcelJS.Workbook(),sheet=book.addWorksheet(c("الساعات","Hours"),{views:[{state:"frozen",ySplit:1,rightToLeft:locale==="ar"}]});
 const state=data.state,hours=state==="Approved"?c("الساعات المعتمدة","Approved hours"):state==="Pending"?c("الساعات بانتظار الاعتماد","Pending hours"):state==="Rejected"?c("الساعات المرفوضة","Rejected hours"):c("الساعات","Hours");
 sheet.addRow([c("الاسم","Name"),c("الرقم الجامعي","University ID"),hours,c("أول نشاط","First activity"),c("آخر نشاط","Last activity")]).font={bold:true};
 const seen=new Set<string>();
 for(const record of data.records){
  if(record.isTest!==false)continue;
  if(seen.has(record.userId))throw new Error("Expected one aggregate per member");seen.add(record.userId);
  const university=record.universityCiphertext?await decryptExportIdentifier(record.universityCiphertext,record.userId,"university-id",key):null;
  const row=sheet.addRow([record.name,university,Math.round(Number(record.hours)),record.firstDate?new Date(`${record.firstDate.slice(0,10)}T00:00:00Z`):null,record.lastDate?new Date(`${record.lastDate.slice(0,10)}T00:00:00Z`):null]);
  row.getCell(2).numFmt="@";row.getCell(3).numFmt="0";row.getCell(4).numFmt="yyyy-mm-dd";row.getCell(5).numFmt="yyyy-mm-dd";
 }
 sheet.eachRow(row=>row.eachCell({includeEmpty:true},cell=>{cell.alignment={horizontal:"right",vertical:"middle",wrapText:false};}));
 sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:5}};
 sheet.columns.forEach(column=>{let width=12;column.eachCell?.({includeEmpty:false},cell=>{width=Math.max(width,cell.value instanceof Date?12:Math.min(String(cell.value??"").length+2,48));});column.width=width;});
 return new Uint8Array(await book.xlsx.writeBuffer());
}

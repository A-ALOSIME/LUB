import ExcelJS from "exceljs";
type Locale="ar"|"en";
function academicTerm(value:string,locale:Locale){if(locale==="en")return value;return value.replace(/(?:الترم|الفصل(?: الدراسي)?)\s*(?:الاول|الأول|1)/g,"الفصل الدراسي الأول").replace(/(?:الترم|الفصل(?: الدراسي)?)\s*(?:الثاني|2)/g,"الفصل الدراسي الثاني").replace(/(?:الترم|الفصل(?: الدراسي)?)\s*(?:الثالث|3)/g,"الفصل الدراسي الثالث");}
export type HoursExport={organization:string;slug:string;records:Array<{name:string;committee:string|null;description:string;hours:string;activity_date:string;term:string;status_code:string;source_code:string;added_by:string|null}>};
export async function hoursWorkbook(data:HoursExport,locale:Locale){
 const c=(ar:string,en:string)=>locale==="ar"?ar:en,book=new ExcelJS.Workbook(),sheet=book.addWorksheet(c("الساعات","Hours"),{views:[{state:"frozen",ySplit:1,rightToLeft:locale==="ar"}]});
 sheet.columns=[["name",c("العضو","Member")],["committee",c("اللجنة","Committee")],["description",c("السبب","Reason")],["hours",c("الساعات","Hours")],["date",c("التاريخ","Date")],["term",c("الفصل الدراسي","Academic term")],["status",c("الحالة","Status")],["source",c("المصدر","Source")],["actor",c("أضافها","Added by")]].map(([key,header])=>({key,header}));
 const status:Record<string,string>={Approved:c("معتمدة","Approved"),Pending:c("بانتظار الاعتماد","Pending approval"),Rejected:c("مرفوضة","Rejected"),Voided:c("مبطلة","Voided")},source:Record<string,string>={MANUAL:c("إضافة يدوية","Manual entry"),SELF_REPORTED:c("طلب ذاتي","Self-reported"),TASK:c("مهمة","Task"),EVENT:c("فعالية","Event")};
 for(const record of data.records){const row=sheet.addRow([record.name,record.committee||null,record.description||null,Number(record.hours),new Date(`${record.activity_date.slice(0,10)}T00:00:00Z`),academicTerm(record.term,locale),status[record.status_code]??record.status_code,source[record.source_code]??record.source_code,record.added_by||null]);row.getCell(5).numFmt="yyyy-mm-dd";row.height=22;}
 sheet.getRow(1).font={bold:true};sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:9}};
 sheet.columns.forEach(column=>{let width=12;column.eachCell?.({includeEmpty:false},cell=>{width=Math.max(width,Math.min(String(cell.value??"").length+2,48));});column.width=width;});
 return new Uint8Array(await book.xlsx.writeBuffer());
}

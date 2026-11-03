import {expect,it,vi,afterEach} from "vitest";
import ExcelJS from "exceljs";
vi.mock("server-only",()=>({}));
import {encryptIdentifier} from "../src/lib/identifiers";
import {membersXlsx,exportFilename,type MemberExportRecord} from "../supabase/functions/export-members/xlsx";
afterEach(()=>vi.unstubAllEnvs());
it("exports precisely twelve typed columns with raw strings, true dates and spreadsheet controls",async()=>{
 const secret=Buffer.alloc(32,3).toString("base64");vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY",secret);vi.stubEnv("IDENTIFIER_LOOKUP_KEY",Buffer.alloc(32,4).toString("base64"));const user="00000000-0000-4000-8000-000000000001";
 const record:MemberExportRecord={isTest:false,userId:user,name:"=1+1",universityCiphertext:encryptIdentifier("0441234567",user),nationalCiphertext:encryptIdentifier("1000000000",user,"national-id"),major:"نظم المعلومات",level:"12",status:"Active",email:"student@example.invalid",phone:"+966551234567",hours:20,startDate:"2026-01-05",roles:[{code:"CL",committee:null,startDate:"2026-01-05",endDate:null},{code:"OL",committee:null,startDate:"2026-01-05",endDate:null}],committees:[{name:"الأنشطة",status:"Active",startDate:"2026-01-05",endDate:null},{name:"المحتوى",status:"Ended",startDate:"2026-01-05",endDate:null}]};
 const bytes=await membersXlsx([record],secret,"ar"),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(bytes).buffer);const sheet=workbook.worksheets[0],row=sheet.getRow(2);
 expect(sheet.columnCount).toBe(12);expect(sheet.rowCount).toBe(2);expect(row.getCell(1).value).toBe("=1+1");expect(row.getCell(1).type).toBe(ExcelJS.ValueType.String);expect(row.getCell(2).value).toBe("0441234567");expect(row.getCell(3).value).toBe("1000000000");expect(row.getCell(4).value).toBe("0551234567");expect(row.getCell(7).value).toBe("الثاني عشر");expect(row.getCell(8).value).toBe("قائد الجهة");expect(row.getCell(9).value).toBe("الأنشطة، المحتوى");expect(row.getCell(10).value).toEqual(new Date("2026-01-05T00:00:00Z"));expect(row.getCell(10).numFmt).toBe("yyyy-mm-dd");expect(row.getCell(11).type).toBe(ExcelJS.ValueType.Number);expect(row.getCell(11).value).toBe(20);expect(sheet.views[0]).toMatchObject({state:"frozen",ySplit:1,rightToLeft:true});expect(sheet.autoFilter).toBeTruthy();expect(sheet.getRow(1).font.bold).toBe(true);expect(row.height).toBeUndefined();sheet.eachRow(r=>r.eachCell(cell=>{expect(cell.alignment.horizontal).toBe("right");expect(cell.alignment.wrapText).not.toBe(true);}));
});
it("uses a safe English filename and Riyadh date",()=>{expect(exportFilename("club-tech","Active",new Date("2026-11-01T22:00:00Z"))).toBe("club-tech-active-2026-11-02.xlsx");});

it("never exports a test-flagged record even if upstream returned it",async()=>{const secret=Buffer.alloc(32,3).toString("base64"),bytes=await membersXlsx([{isTest:true} as MemberExportRecord],secret,"en"),book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(bytes).buffer);expect(book.worksheets[0].rowCount).toBe(1);});

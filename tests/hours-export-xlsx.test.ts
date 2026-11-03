import ExcelJS from "exceljs";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {encryptIdentifier} from "../src/lib/identifiers";
import {hoursWorkbook,type HoursExport} from "../supabase/functions/export-hours/xlsx";
const secret=Buffer.alloc(32,3).toString("base64"),user="00000000-0000-4000-8000-000000000001";
afterEach(()=>vi.unstubAllEnvs());
it("writes five typed columns, rounds each member total and preserves leading zeros without apostrophes",async()=>{
 vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY",secret);vi.stubEnv("IDENTIFIER_LOOKUP_KEY",Buffer.alloc(32,4).toString("base64"));
 const data:HoursExport={organization:"Club",slug:"club",state:"Pending",records:[{userId:user,name:"=Student",universityCiphertext:encryptIdentifier("0441234567",user),hours:"3.5",firstDate:"2026-10-01",lastDate:"2026-11-01",isTest:false},{userId:"peer",name:"Peer",universityCiphertext:null,hours:"1.49",firstDate:"2026-11-01",lastDate:"2026-11-01",isTest:false}]};
 const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await hoursWorkbook(data,"ar",secret)).buffer);const sheet=book.worksheets[0];
 expect(sheet.columnCount).toBe(5);expect(sheet.rowCount).toBe(3);expect(sheet.getCell("C1").value).toBe("الساعات بانتظار الاعتماد");
 expect(sheet.getCell("A2").value).toBe("=Student");expect(sheet.getCell("A2").type).toBe(ExcelJS.ValueType.String);expect(sheet.getCell("B2").value).toBe("0441234567");expect(sheet.getCell("B2").type).toBe(ExcelJS.ValueType.String);expect(sheet.getCell("B3").value).toBeNull();
 expect(sheet.getCell("C2").value).toBe(4);expect(sheet.getCell("C3").value).toBe(1);expect(sheet.getCell("D2").value).toEqual(new Date("2026-10-01T00:00:00Z"));expect(sheet.getCell("E2").numFmt).toBe("yyyy-mm-dd");
 expect(sheet.views[0]).toMatchObject({rightToLeft:true,state:"frozen",ySplit:1});expect(sheet.autoFilter).toBeTruthy();expect(sheet.getRow(1).font.bold).toBe(true);
 sheet.eachRow(row=>{expect(row.height).toBeUndefined();row.eachCell(cell=>{expect(cell.alignment.horizontal).toBe("right");expect(cell.alignment.wrapText).not.toBe(true);expect(cell.type).not.toBe(ExcelJS.ValueType.Formula);});});
});
it("fails closed for test or unclassified records and rejects duplicate member aggregates",async()=>{
 const row={userId:user,name:"Student",universityCiphertext:null,hours:"1",firstDate:"2026-11-01",lastDate:"2026-11-01",isTest:true},data:HoursExport={organization:"Club",slug:"club",records:[row]};
 const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await hoursWorkbook(data,"en",secret)).buffer);expect(book.worksheets[0].rowCount).toBe(1);
 await expect(hoursWorkbook({...data,records:[{...row,isTest:false},{...row,isTest:false}]},"en",secret)).rejects.toThrow("one aggregate");
});

import {expect,it,vi,afterEach} from "vitest";
import ExcelJS from "exceljs";
vi.mock("server-only",()=>({}));
import {encryptIdentifier} from "../src/lib/identifiers";
import {registrantsWorkbook,type RegistrantExportRecord} from "../supabase/functions/export-registrants/xlsx";
import {createRegistrantsExportHandler} from "../supabase/functions/export-registrants/handler";
afterEach(()=>vi.unstubAllEnvs());
it("reports an hourly quota only for the explicit quota exception, not other PostgreSQL program limits",async()=>{
 const id="00000000-0000-4000-8000-000000000001",env=(key:string)=>({SUPABASE_URL:"https://example.invalid",SUPABASE_ANON_KEY:"public-key",IDENTIFIER_ENCRYPTION_KEY:"configured"})[key as "SUPABASE_URL"];
 for(const [message,status] of [["Export rate limit",429],["stack depth limit exceeded",502]] as const){
  const handler=createRegistrantsExportHandler({env,fetcher:vi.fn(async(url:RequestInfo|URL)=>String(url).endsWith("/auth/v1/user")?Response.json({id}):Response.json({code:"54000",message},{status:500}))});
  const response=await handler(new Request("https://edge.invalid",{method:"POST",headers:{authorization:"Bearer actual-token"},body:JSON.stringify({org:id,event:id,committee:null,q:"",state:"",locale:"ar"})}));
  expect(response.status).toBe(status);expect(await response.text()).not.toContain(message);
 }
});
it("writes accepted and recorded students once, preserves leading zeroes and uses real dates and right-aligned non-wrapped cells",async()=>{
 const secret=Buffer.alloc(32,3).toString("base64");vi.stubEnv("IDENTIFIER_ENCRYPTION_KEY",secret);vi.stubEnv("IDENTIFIER_LOOKUP_KEY",Buffer.alloc(32,4).toString("base64"));
 const user="00000000-0000-4000-8000-000000000001",base:RegistrantExportRecord={userId:user,isTest:false,name:"=1+1",universityCiphertext:encryptIdentifier("0441234567",user),nationalCiphertext:encryptIdentifier("1000000000",user,"national-id"),phone:"+966551234567",email:"student@example.invalid",major:"الحاسب",level:"12",registeredDate:"2026-11-03",status:"Recorded",hours:"2.6"};
 const bytes=await registrantsWorkbook({slug:"club",eventId:"event",eventTitle:"الورشة",records:[base,{...base,isTest:true},{...base,status:"Pending"},{...base,status:"Rejected"},{...base,status:"Withdrawn"}]},"ar",secret),book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(bytes).buffer);const sheet=book.worksheets[0],row=sheet.getRow(2);
 expect(sheet.columnCount).toBe(10);expect(sheet.rowCount).toBe(2);expect(row.getCell(1).value).toBe("=1+1");expect(row.getCell(1).type).toBe(ExcelJS.ValueType.String);expect(row.getCell(2).value).toBe("0441234567");expect(row.getCell(3).value).toBe("1000000000");expect(row.getCell(4).value).toBe("0551234567");expect(row.getCell(7).value).toBe("الثاني عشر");expect(row.getCell(8).value).toEqual(new Date("2026-11-03T00:00:00Z"));expect(row.getCell(8).numFmt).toBe("yyyy-mm-dd");expect(row.getCell(9).value).toBe("مرصودة");expect(row.getCell(10).value).toBe(3);expect(sheet.views[0]).toMatchObject({state:"frozen",ySplit:1,rightToLeft:true});expect(sheet.autoFilter).toBeTruthy();sheet.eachRow(r=>{expect(r.height).toBeUndefined();r.eachCell(cell=>{expect(cell.alignment.horizontal).toBe("right");expect(cell.alignment.wrapText).not.toBe(true);});});
 await expect(registrantsWorkbook({slug:"club",eventId:"event",eventTitle:"",records:[base,base]},"en",secret)).rejects.toThrow("one registrant");
});
it("validates the real JWT, forwards the selected event and filters and consumes a ticket before streaming a workbook",async()=>{
 const id="00000000-0000-4000-8000-000000000001",env=(key:string)=>({SUPABASE_URL:"https://example.invalid",SUPABASE_ANON_KEY:"public-key",IDENTIFIER_ENCRYPTION_KEY:Buffer.alloc(32,3).toString("base64")})[key as "SUPABASE_URL"],calls:Array<{url:string;body:unknown}>=[];
 const fetcher=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null});if(String(url).endsWith("/auth/v1/user"))return Response.json({id});if(String(url).endsWith("prepare_registrant_export"))return Response.json({ticket:id});return Response.json({slug:"club",eventId:id,eventTitle:"ورشة",records:[]});});
 const handler=createRegistrantsExportHandler({env,fetcher}),body={org:id,event:id,committee:null,q:"أحمد",state:"Recorded",locale:"ar"};
 expect((await handler(new Request("https://edge.invalid",{method:"POST",body:JSON.stringify(body)}))).status).toBe(401);expect(calls).toHaveLength(0);
 const response=await handler(new Request("https://edge.invalid",{method:"POST",headers:{authorization:"Bearer actual-token"},body:JSON.stringify(body)}));expect(response.status).toBe(200);expect(calls[1].body).toEqual({org:id,committee:null,event:id,state:"Recorded",query:"أحمد"});expect(calls[2].body).toEqual({target:id});expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="club-registrants-[a-z0-9-]+-recorded-\d{4}-\d{2}-\d{2}\.xlsx"$/);
 const denied=createRegistrantsExportHandler({env,fetcher:vi.fn().mockResolvedValue(new Response(null,{status:401}))});expect((await denied(new Request("https://edge.invalid",{method:"POST",headers:{authorization:"Bearer invalid"},body:JSON.stringify(body)}))).status).toBe(401);
});

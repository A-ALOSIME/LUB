import {beforeEach,expect,it,vi} from "vitest";

const mocks=vi.hoisted(()=>({user:vi.fn(),execute:vi.fn(),invalidate:vi.fn()}));
vi.mock("@/features/auth/session",()=>({requireUser:mocks.user}));
vi.mock("@/db/client",()=>({withUser:async(_id:string,operation:(tx:{execute:typeof mocks.execute})=>Promise<unknown>)=>operation({execute:mocks.execute})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.invalidate,updateTag:mocks.invalidate}));
import {mutateEvent} from "./actions";

const event="00000000-0000-4000-8000-000000000101";
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:"verified-user"});});
function form(values:Record<string,string>){const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,value);return data;}

it("accepts a bounded public event report and HTTPS photo links from a verified user",async()=>{
 const state=await mutateEvent({},form({operation:"public-content",event,report:"ملخص الفعالية",photos:"https://example.com/1.png\nhttps://example.com/2.png"}));
 expect(state.success).toBeDefined();expect(mocks.execute).toHaveBeenCalledTimes(1);
});
it("rejects unsafe public photo links before any database call",async()=>{
 for(const photos of ["http://example.com/1.png","https://user:pass@example.com/1.png",Array.from({length:5},(_,i)=>`https://example.com/${i}.png`).join("\n")]){
  expect((await mutateEvent({},form({operation:"public-content",event,report:"تقرير",photos}))).error).toBeDefined();
 }
 expect(mocks.execute).not.toHaveBeenCalled();
});

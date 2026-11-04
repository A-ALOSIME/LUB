import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),database:vi.fn(),cache:vi.fn()}));
vi.mock("@/features/auth/session",()=>({requireUser:mocks.user}));
vi.mock("@/features/auth/authorization",()=>({studentOperationError:vi.fn()}));
vi.mock("@/db/client",()=>({withUser:mocks.database}));
vi.mock("next/cache",()=>({revalidatePath:mocks.cache,updateTag:mocks.cache}));
import {mutateHours} from "./actions";
function term(starts="2027-01-01",ends="2027-05-01"){const data=new FormData();Object.entries({operation:"term",year:"2027",code:"T1",name:"الفصل الدراسي الأول",starts,ends}).forEach(([key,value])=>data.set(key,value));return data;}
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:"verified-admin"});mocks.database.mockResolvedValue([]);});
it("rejects reversed dates before attempting a term mutation",async()=>{expect((await mutateHours({},term("2027-05-01","2027-01-01"))).error).toBe("يجب أن تكون نهاية الفصل في تاريخ البداية أو بعده.");expect(mocks.database).not.toHaveBeenCalled();});
it("explains an overlapping term without exposing database details",async()=>{mocks.database.mockRejectedValue({cause:{code:"P0001",message:"Overlapping term"}});expect((await mutateHours({},term())).error).toBe("تتداخل هذه الفترة مع فصل محفوظ. اختر تواريخ لا تتداخل مع الفصول الحالية.");expect(mocks.cache).not.toHaveBeenCalled();});
it("creates terms only through the verified actor and revalidates the workspace",async()=>{expect((await mutateHours({},term())).success).toBeDefined();expect(mocks.database.mock.calls[0][0]).toBe("verified-admin");expect(mocks.cache).toHaveBeenCalledWith("/manage/organizations/[id]/tasks","page");expect(mocks.cache).not.toHaveBeenCalledWith("/manage","layout");});

function bulk(){const form=new FormData();Object.entries({operation:"add-selected",org:"00000000-0000-4000-8000-000000000101",members:JSON.stringify(["00000000-0000-4000-8000-000000000201","00000000-0000-4000-8000-000000000202"]),hours:"2",day:"2026-11-04",reason:"Verified contribution"}).forEach(([key,value])=>form.set(key,value));return form;}
it("checks every selected membership belongs to the current organization before writing hours",async()=>{const execute=vi.fn().mockResolvedValue([{id:"one"}]);mocks.database.mockImplementation(async(_actor,run)=>run({execute}));expect((await mutateHours({},bulk())).error).toBeDefined();expect(execute).toHaveBeenCalledTimes(1);expect(mocks.cache).not.toHaveBeenCalled();});
it("adds hours through the verified actor and checks SQL permissions for each selected membership",async()=>{const execute=vi.fn().mockResolvedValueOnce([{id:"one"},{id:"two"}]).mockResolvedValue([]);mocks.database.mockImplementation(async(_actor,run)=>run({execute}));expect((await mutateHours({},bulk())).success).toBeDefined();expect(mocks.database.mock.calls[0][0]).toBe("verified-admin");expect(execute).toHaveBeenCalledTimes(3);});

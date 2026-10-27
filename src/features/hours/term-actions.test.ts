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
it("creates terms only through the verified actor and revalidates the workspace",async()=>{expect((await mutateHours({},term())).success).toBeDefined();expect(mocks.database.mock.calls[0][0]).toBe("verified-admin");expect(mocks.cache).toHaveBeenCalledWith("/manage","layout");});

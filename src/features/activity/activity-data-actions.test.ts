import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),tasks:vi.fn(),events:vi.fn(),hours:vi.fn(),version:vi.fn()}));
vi.mock("@/features/auth/authorization",()=>({requireStudentUser:mocks.auth}));
vi.mock("@/features/tasks/repository",()=>({listTasks:mocks.tasks}));
vi.mock("@/features/events/repository",()=>({myEvents:mocks.events}));
vi.mock("@/features/hours/repository",()=>({myHours:mocks.hours}));
vi.mock("./revision",()=>({activityRevision:mocks.version}));
import {loadActivitySnapshot} from "./activity-data-actions";
afterEach(()=>vi.resetAllMocks());
it("derives the owner from verified authentication and requests all filters without page-one limits",async()=>{
 mocks.auth.mockResolvedValue({id:"verified-owner"});mocks.version.mockResolvedValue("fingerprint");mocks.tasks.mockResolvedValue({items:[],more:false});mocks.events.mockResolvedValue({status:"Active",onboarded:true,events:[]});mocks.hours.mockResolvedValue({records:[]});
 const snapshot=await loadActivitySnapshot();expect(snapshot.actorId).toBe("verified-owner");expect(snapshot.version).toBe("fingerprint");expect(mocks.tasks.mock.calls).toEqual([["verified-owner",{view:"available",page:null}],["verified-owner",{view:"mine",page:null}]]);expect(mocks.hours).toHaveBeenCalledWith("verified-owner",null,null);expect(mocks.events).toHaveBeenCalledWith("verified-owner",null);
});
it("never fetches private activity after the server rejects authentication",async()=>{mocks.auth.mockRejectedValue(new Error("unauthorized"));await expect(loadActivitySnapshot()).rejects.toThrow("unauthorized");expect(mocks.tasks).not.toHaveBeenCalled();expect(mocks.events).not.toHaveBeenCalled();expect(mocks.hours).not.toHaveBeenCalled();});

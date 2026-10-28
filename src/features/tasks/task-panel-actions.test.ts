import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),detail:vi.fn(),workspace:vi.fn()}));
vi.mock("@/features/organizations/access",()=>({requireStudentManagementUser:mocks.user}));
vi.mock("./repository",()=>({taskDetail:mocks.detail,taskWorkspace:mocks.workspace}));
import {loadTaskPanel} from "./task-panel-actions";
const task="00000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:"authenticated-user"});});
it("loads student details through the authenticated actor without loading management data",async()=>{
 const detail={task:{organization_id:"org"},canManage:false};mocks.detail.mockResolvedValue(detail);
 expect(await loadTaskPanel(task,{page:1})).toEqual({detail,workspace:undefined});
 expect(mocks.detail).toHaveBeenCalledWith("authenticated-user",task,null,1,0,0);
 expect(mocks.workspace).not.toHaveBeenCalled();
});
it("loads the editor workspace only after the repository confirms management permission",async()=>{
 const detail={task:{organization_id:"org"},canManage:true};mocks.detail.mockResolvedValue(detail);mocks.workspace.mockResolvedValue({name:"authorized"});
 expect((await loadTaskPanel(task)).workspace).toEqual({name:"authorized"});
 expect(mocks.workspace).toHaveBeenCalledWith("authenticated-user","org");
});
it("rejects malformed identifiers and unbounded pages before querying",async()=>{
 expect((await loadTaskPanel(task,{page:-1})).error).toBeTruthy();
 expect((await loadTaskPanel("not-an-id")).error).toBeTruthy();
 expect((await loadTaskPanel(task,{participant:"not-an-id"})).error).toBeTruthy();
 expect(mocks.detail).not.toHaveBeenCalled();
});
it("does not expose missing records or database error details",async()=>{
 mocks.detail.mockResolvedValue(undefined);expect((await loadTaskPanel(task)).error).toBeTruthy();
 mocks.detail.mockRejectedValue(new Error("private database message"));
 expect(JSON.stringify(await loadTaskPanel(task))).not.toContain("private database");
});

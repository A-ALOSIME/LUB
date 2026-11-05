import {it,expect} from "vitest";
import {taskReturnPath} from "./task-navigation";
it("preserves task list searches and rejects unrelated or external return targets",()=>{
 expect(taskReturnPath("/activity?tab=tasks&taskFilter=mine&q=design","/activity")).toBe("/activity?tab=tasks&taskFilter=mine&q=design");
 for(const value of ["//example.com","https://example.com","/\\example.com","/account","/manage/organizations/org/tasks/123"])expect(taskReturnPath(value,"/activity")).toBe("/activity");
});

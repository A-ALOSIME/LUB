import {expect,it} from "vitest";
import {z} from "zod";
import {classifySubmissionError,SubmissionFault,submissionErrorMessage} from "./submission-errors";
it.each([
 [new SubmissionFault("empty"),"empty"],
 [{cause:{message:"Invalid attachment"}},"attachment"],
 [{cause:{message:"Participation unavailable",code:"42501"}},"unavailable"],
 [{cause:{message:"Define academic term before approval",code:"P0002"}},"setup"],
 [{cause:{code:"23502",message:"missing task revision"}},"setup"],
 [{cause:{code:"42501"}},"access"],
 [{cause:{code:"23505",constraint_name:"one_pending_task_submission_idx"}},"pending"],
 [new Error("connection terminated: private SQL"),"service"],
] as const)("classifies %j safely as %s",(error,expected)=>expect(classifySubmissionError(error)).toBe(expected));
it("separates invalid user input and provides localized, safe messages",()=>{
 const parsed=z.uuid().safeParse("bad");expect(classifySubmissionError(parsed.error)).toBe("input");
 expect(submissionErrorMessage("setup","ar")).toContain("قائد الجهة");expect(submissionErrorMessage("setup","en")).toContain("organization leader");expect(submissionErrorMessage("empty","ar")).toContain("أضف وصفًا");
});

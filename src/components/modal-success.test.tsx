// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const action=vi.hoisted(()=>vi.fn());
vi.mock("@/features/forms/actions",()=>({mutateWorkflow:action}));
vi.mock("@/features/hours/actions",()=>({mutateHours:action}));
vi.mock("@/features/tasks/actions",()=>({mutateTask:action}));
vi.mock("@/features/organizations/actions",()=>({mutateOrganization:action}));
import {WorkflowForm} from "@/features/forms/mutation-form";
import {HoursForm} from "@/features/hours/form";
import {TaskForm} from "@/features/tasks/task-form";
import {MutationForm} from "@/features/organizations/mutation-form";
import {ManagementActionProvider} from "./management-action-sheet";
import {toast} from "./ui/toast";
const variants=["workflow","hours","task","organization"] as const;
function Form({kind,onSuccess}:{kind:typeof variants[number];onSuccess:()=>void}){const child=<label>Value<input name="title" defaultValue="Keep"/></label>;return kind==="workflow"?<WorkflowForm operation="create-form" label="Save" onSuccess={onSuccess}>{child}</WorkflowForm>:kind==="hours"?<HoursForm operation="create-campaign" label="Save" onSuccess={onSuccess}>{child}</HoursForm>:kind==="task"?<TaskForm operation="save-task" label="Save" onSuccess={onSuccess}>{child}</TaskForm>:<MutationForm operation="save-announcement" submitLabel="Save" onSuccess={onSuccess}>{child}</MutationForm>;}
beforeEach(()=>{action.mockReset().mockResolvedValue({success:"Saved"});});afterEach(()=>{cleanup();vi.restoreAllMocks();});
it.each(variants)("closes a %s modal once after success, keeping its success toast",async kind=>{const close=vi.fn(),saved=vi.fn(),add=vi.spyOn(toast,"add");render(<ManagementActionProvider locale="en" close={close}><Form kind={kind} onSuccess={saved}/></ManagementActionProvider>);fireEvent.submit(screen.getByRole("button",{name:"Save"}).closest("form")!);await waitFor(()=>expect(close).toHaveBeenCalledTimes(1));expect(saved).toHaveBeenCalledTimes(1);expect(add).toHaveBeenCalledWith(expect.objectContaining({type:"success",timeout:3000}));});
it.each(variants)("keeps a %s modal and typed data on error",async kind=>{action.mockResolvedValue({error:"Failed"});const close=vi.fn(),add=vi.spyOn(toast,"add");render(<ManagementActionProvider locale="en" close={close}><Form kind={kind} onSuccess={vi.fn()}/></ManagementActionProvider>);fireEvent.submit(screen.getByRole("button",{name:"Save"}).closest("form")!);await screen.findByRole("alert");expect(close).not.toHaveBeenCalled();expect(screen.getByLabelText("Value")).toHaveProperty("value","Keep");await waitFor(()=>expect(add).toHaveBeenCalledWith(expect.objectContaining({type:"error",timeout:0})));});

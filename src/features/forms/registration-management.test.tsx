// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
import {RegistrationManagement} from "./registration-management";
import type {OrganizationRegistrationWorkspace} from "./repository";

const {mutate} = vi.hoisted(() => ({mutate:vi.fn().mockResolvedValue({success:"Saved"})}));
vi.mock("./actions", () => ({mutateWorkflow:mutate}));
vi.mock("./repository", () => ({statuses:{Published:"Published"}}));
vi.mock("./paged-template-list", () => ({PagedTemplateList:() => null}));
vi.mock("./registration-template-table", () => ({RegistrationTemplateTable:() => null}));
vi.mock("next/navigation", () => ({useRouter:() => ({refresh:vi.fn()})}));
afterEach(cleanup);

it("opens a published form directly and saves edits to its current revision", async () => {
  const organization = "org";
  const template = "template";
  const workspace:OrganizationRegistrationWorkspace = {
    name:"Council", accountStatus:"Active", onboarded:true, allowed:["FORMS_MANAGE"],
    rounds:[], committees:[],
    templates:[{
      id:template, name:"Published form", organization_id:organization, round_count:1,
      versions:[{
        id:template, status_code:"Published", version_number:2, revision:2,
        definition:{layout:"SinglePage", sections:[{
          id:"00000000-0000-4000-8000-000000000001", title:"Application", description:"", fields:[{
            id:"00000000-0000-4000-8000-000000000002", type:"ShortText", label:"Why join?", help:"",
            required:true, options:[], maxLength:300,
          }],
        }]},
      }],
    }],
  };

  render(<RegistrationManagement workspace={workspace} organization={organization} selectedTemplate={template} locale="en"/>);
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:/Application/}));
  fireEvent.click(screen.getByRole("button",{name:/Why join/}));
  expect(screen.queryByRole("button",{name:"Publish version"})).toBeNull();
  fireEvent.change(screen.getByRole("textbox",{name:"Question"}),{target:{value:"Why this club?"}});
  fireEvent.click(screen.getByRole("button",{name:"Save changes"}));

  await waitFor(() => expect((screen.getByRole("button",{name:"Save changes"}) as HTMLButtonElement).disabled).toBe(true));
  expect(mutate).toHaveBeenCalledOnce();
  const form = mutate.mock.calls[0][1] as FormData;
  expect(form.get("operation")).toBe("save-form");
  expect(form.get("revision")).toBe("2");
  expect(form.get("definition")).toContain("Why this club?");
});

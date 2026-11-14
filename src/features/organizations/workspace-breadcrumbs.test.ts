import {describe,expect,it} from "vitest";
import {workspaceBreadcrumbs} from "./workspace-breadcrumbs";

const organization={id:"org-1",nameAr:"نادي التقنية",canEdit:true};
const root="/manage/organizations/org-1";

describe("workspace breadcrumbs",()=>{
  it("links the managed task to its real section and uses the current title",()=>{
    expect(workspaceBreadcrumbs(`${root}/tasks/task-1`,"ar",[organization],{label:"البحث عن رعاة"})).toEqual([
      {label:"مساحتي",href:"/me"},
      {label:"نادي التقنية",href:root},
      {label:"المهام والساعات",href:`${root}/tasks`},
      {label:"البحث عن رعاة"},
    ]);
  });
  it("keeps the organization label when the viewer cannot open its settings",()=>{
    const [,org]=workspaceBreadcrumbs(`${root}/tasks/task-1`,"en",[{...organization,canEdit:false}]);
    expect(org).toEqual({label:"نادي التقنية",href:undefined});
  });
  it("shows the active tab and names the form editor",()=>{
    expect(workspaceBreadcrumbs("/manage/organizations","ar",[],undefined,"?tab=requests").at(-1)?.label).toBe("طلبات فتح الأندية");
    expect(workspaceBreadcrumbs(`${root}/renewals`,"en",[organization],{label:"Joining form"},"?section=forms&template=form-1").slice(-2)).toEqual([
      {label:"Forms",href:`${root}/renewals?section=forms`},{label:"Joining form"},
    ]);
  });
  it("uses the canonical list links for personal tasks, applications, renewals and adding organizations",()=>{
    expect(workspaceBreadcrumbs("/tasks/task-1/","en",[]).at(-2)?.href).toBe("/activity?tab=tasks");
    expect(workspaceBreadcrumbs(`${root}/applications/request-1`,"en",[organization]).at(-2)?.href).toBe(`${root}/members?section=applications`);
    expect(workspaceBreadcrumbs("/registration/renewal/1","en",[organization],{label:"Fall",organization:organization.id}).at(-2)?.href).toBe(`${root}/renewals`);
    expect(workspaceBreadcrumbs("/manage/organizations/new","en",[]).at(-2)?.href).toBe("/manage/organizations");
  });
});

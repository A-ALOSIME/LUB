// @vitest-environment jsdom
import {cleanup,render,screen,within} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import {PrivateQueryProvider} from "@/components/private-query-provider";
import {I18nProvider} from "@/components/i18n-provider";
import {RenewalParticipantTable} from "./participant-table";
const data={organization:"org",title:"Renewal",items:[{id:"r",name:"Sara",major:"Computer Science",level:"5",status:"Renewed",at:"2026-11-03T10:15:00Z"}],counts:{Renewed:1},total:1,more:false};
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState(null,"","/");});
it("renders exactly student/status/date with no selection or row actions",()=>{
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json(data)));
 render(<I18nProvider locale="en"><PrivateQueryProvider actorId="leader"><RenewalParticipantTable campaign="campaign" initial={data} initialFilters={{q:"",status:"all",page:0}} locale="en"/></PrivateQueryProvider></I18nProvider>);
 const table=within(screen.getByRole("table"));expect(table.getAllByRole("columnheader").map(cell=>cell.textContent)).toEqual(["Student","Status","Date"]);expect(screen.queryByRole("checkbox")).toBeNull();expect(table.getAllByRole("button")).toHaveLength(3);expect(table.getAllByRole("row")[1].querySelector("button")).toBeNull();expect(table.getByText("Sara")).toBeTruthy();expect(table.getByText("Accepted")).toBeTruthy();expect(table.getByText("3 November 2026")).toBeTruthy();expect(screen.queryByRole("dialog")).toBeNull();
});

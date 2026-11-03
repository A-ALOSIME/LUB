// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
import {ItemTable} from "./item-table";
import {RowAction} from "./row-action";
afterEach(cleanup);
it("opens a row and card by pointer or Enter without swallowing action clicks",()=>{
 const open=vi.fn(),action=vi.fn(),prefetch=vi.fn();
 render(<ItemTable label="View item" items={[{id:"1",title:"Title"}]} onOpen={open} onPrefetch={prefetch} columns={[{id:"name",label:"Name",render:x=>x.title},{id:"actions",label:"Actions",render:()=> <RowAction label="Copy" onClick={action}>C</RowAction>}]}/>);
 const row=screen.getAllByRole("row")[1];fireEvent.mouseEnter(row);expect(prefetch).toHaveBeenCalledOnce();fireEvent.click(row);fireEvent.keyDown(row,{key:"Enter"});expect(open).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getAllByRole("button",{name:"Copy"})[0]);expect(action).toHaveBeenCalledOnce();expect(open).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByRole("listitem").firstElementChild!);expect(open).toHaveBeenCalledTimes(3);
});

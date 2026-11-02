// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {CopyMemberValue,MemberDetailSheet} from "./member-detail-sheet";
import type {MemberRecord} from "./member-types";
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const record:MemberRecord={id:'membership',name:'طالب',major:'الحاسب',level:'5',status:'Active',startDate:'2026-10-01',endDate:null,universityId:'0441234567',nationalId:'1000000000',email:'student@example.invalid',phone:'+966551234567',avatar:null,organization:{name:'مجلس',slug:'qa'},hours:10,roles:[],committees:[],events:[{code:'Rejoined',at:'2026-10-01',actor:null,imported:true}]};
it('copies identifiers, phone and a complete section without changing their raw values',async()=>{
 const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 render(<MemberDetailSheet open onOpenChange={()=>{}} record={record} error={false} locale="ar"/>);
 for(const [label,value]of [['نسخ الرقم الجامعي','0441234567'],['نسخ رقم الهوية أو الإقامة','1000000000'],['نسخ البريد الجامعي','student@example.invalid'],['نسخ رقم الجوال','+966551234567']]){fireEvent.click(screen.getByRole('button',{name:label}));await waitFor(()=>expect(writeText).toHaveBeenLastCalledWith(value));}
 fireEvent.click(screen.getAllByRole('button',{name:'نسخ القسم كاملاً'})[1]);await waitFor(()=>expect(writeText).toHaveBeenLastCalledWith('الرقم الجامعي: 0441234567\nرقم الهوية أو الإقامة: 1000000000\nالتخصص: الحاسب\nالمستوى الدراسي: المستوى الخامس'));
 expect(document.querySelector('[data-slot=sheet-content]')?.getAttribute('data-side')).toBe('left');expect(screen.getByText('عاد إلى الجهة')).toBeTruthy();
});
it('explains manual selection when clipboard access is refused',async()=>{
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('Denied'))}});
 render(<CopyMemberValue value="0441234567" label="Copy" locale="en"/>);fireEvent.click(screen.getByRole('button',{name:'Copy'}));expect(await screen.findByRole('alert')).toHaveProperty('textContent','Copy unavailable. Select the text and copy it manually.');
});

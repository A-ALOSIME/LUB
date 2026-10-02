// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
vi.mock('./actions',()=>({mutateDocument:async()=>({error:'تعذّر إنشاء المستند'})}));
import {DocumentForm,PeriodFields} from './form';
afterEach(cleanup);
it('retains the custom period and focuses the failure for a retry',async()=>{
 render(<DocumentForm operation="generate" label="إنشاء"><PeriodFields terms={[]}/></DocumentForm>);
 fireEvent.change(screen.getByLabelText('الفترة'),{target:{value:'Custom'}});fireEvent.change(screen.getByLabelText('من تاريخ'),{target:{value:'2026-09-01'}});fireEvent.change(screen.getByLabelText('إلى تاريخ'),{target:{value:'2026-09-27'}});fireEvent.click(screen.getByRole('button',{name:'إنشاء'}));
 await waitFor(()=>{expect(screen.getByRole('alert').textContent).toBe('تعذّر إنشاء المستند');expect(document.activeElement).toBe(screen.getByRole('alert'));});expect((screen.getByLabelText('من تاريخ') as HTMLInputElement).value).toBe('2026-09-01');
});
it('submits only the selected period fields',()=>{
 const {container}=render(<DocumentForm operation="generate" label="إنشاء"><PeriodFields terms={[{id:'t',name_ar:'الفصل',academic_year:'2026',term_code:'T1',start_date:'2026-01-01',end_date:'2026-12-31'}]}/></DocumentForm>);
 fireEvent.change(screen.getByLabelText('الفترة'),{target:{value:'Term'}});fireEvent.change(screen.getByLabelText('الفصل'),{target:{value:'t'}});expect(new FormData(container.querySelector('form')!).get('term')).toBe('t');
 fireEvent.change(screen.getByLabelText('الفترة'),{target:{value:'All'}});expect(new FormData(container.querySelector('form')!).get('term')).toBeNull();expect(screen.queryByLabelText('من تاريخ')).toBeNull();
});

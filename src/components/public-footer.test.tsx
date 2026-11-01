// @vitest-environment jsdom
import {createElement} from "react";
import {cleanup,render,screen,fireEvent,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
vi.mock('server-only',()=>({}));vi.mock('next/image',()=>({default:({priority,unoptimized,...props}:Record<string,unknown>)=>{void priority;void unoptimized;return createElement('img',props);}}));
vi.mock('@/lib/preferences',()=>({getPreferences:async()=>({locale:'ar',theme:'dark'})}));vi.mock('@/lib/request-time',()=>({requestTime:()=>Date.parse('2026-11-01T10:00:00Z')}));vi.mock('@/hooks/use-mobile',()=>({useIsMobile:()=>false}));
import {PublicFooter} from './public-footer';
import {FooterContactIcons} from './footer-contact-icons';
afterEach(cleanup);
it('shows the approved legal pages and only the configured contact channels',async()=>{render(await PublicFooter());expect(screen.getByRole('link',{name:'سياسة الخصوصية'}).getAttribute('href')).toBe('/privacy');expect(screen.getByRole('link',{name:'الشروط والأحكام'}).getAttribute('href')).toBe('/terms');expect(screen.getByRole('link',{name:'X'}).getAttribute('href')).toBe('https://x.com/LUB_hq');expect(screen.getByRole('link',{name:'البريد الإلكتروني'}).getAttribute('href')).toBe('mailto:lub.support@gmail.com');expect(screen.getByText(/جميع الحقوق محفوظة/).textContent).toContain('2026');expect(screen.getByText(/جميع الحقوق محفوظة/).textContent).not.toContain(' · ');});
it('hides missing contacts and copies the local phone format on desktop',async()=>{const writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'clipboard',{value:{writeText},configurable:true});const ui=render(<FooterContactIcons contacts={{x:'',email:'',phone:''}} locale="en"/>);expect(document.querySelector('a,button')).toBeNull();ui.rerender(<FooterContactIcons contacts={{x:'',email:'',phone:'+966551979410'}} locale="en"/>);fireEvent.click(screen.getByRole('button',{name:'Copy phone number: 0551979410'}));await waitFor(()=>expect(writeText).toHaveBeenCalledWith('0551979410'));});

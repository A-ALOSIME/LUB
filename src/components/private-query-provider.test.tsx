// @vitest-environment jsdom
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {cleanup,render,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {PrivateQueryProvider} from "./private-query-provider";
import {applicationDetailQuery} from "@/features/forms/application-queries";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("aborts a pending detail fetch as soon as its view unmounts",async()=>{let aborted=false;vi.stubGlobal("fetch",vi.fn((_url:string,options:{signal:AbortSignal})=>new Promise((_resolve,reject)=>options.signal.addEventListener("abort",()=>{aborted=true;reject(new DOMException("Aborted","AbortError"));}))));function Detail(){useQuery(applicationDetailQuery("actor","org","application"));return null;}const view=render(<PrivateQueryProvider actorId="actor"><Detail/></PrivateQueryProvider>);await waitFor(()=>expect(fetch).toHaveBeenCalledOnce());view.unmount();expect(aborted).toBe(true);});
it("clears private cached records when the verified account changes",()=>{let current:ReturnType<typeof useQueryClient>|undefined;function Capture(){current=useQueryClient();return null;}const view=render(<PrivateQueryProvider actorId="first"><Capture/></PrivateQueryProvider>);const previous=current!;previous.setQueryData(["private"],{name:"Private student"});view.rerender(<PrivateQueryProvider actorId="second"><Capture/></PrivateQueryProvider>);expect(current).not.toBe(previous);expect(previous.getQueryData(["private"])).toBeUndefined();expect(current!.getQueryData(["private"])).toBeUndefined();});

// @vitest-environment jsdom
import {cleanup,render} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {useRoutePrefetch} from "./use-route-prefetch";
afterEach(cleanup);
it("prefetches each finite local category once without waiting for another request",()=>{
 const prefetch=vi.fn(),urls=()=>["/hours?status=pending","/hours?status=approved","/hours?status=pending","https://elsewhere.test/","//elsewhere.test/"];
 function View({scope}:{scope:string}){useRoutePrefetch(prefetch,urls,scope);return null;}
 const view=render(<View scope="ar"/>);
 expect(prefetch.mock.calls).toEqual([["/hours?status=pending"],["/hours?status=approved"]]);
 view.rerender(<View scope="ar"/>);expect(prefetch).toHaveBeenCalledTimes(2);
 view.rerender(<View scope="en"/>);expect(prefetch).toHaveBeenCalledTimes(4);
});

import {expect,it} from "vitest";
import {workerLiveness} from "./worker-liveness";
it("serves only public liveness without invoking rendering or database readiness",async()=>{
 const response=workerLiveness(new Request("https://lub.community/api/health"))!;
 expect(response.status).toBe(200);expect(await response.json()).toEqual({status:"ok",service:"lub-web"});expect(response.headers.get("cache-control")).toBe("no-store");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it("keeps HEAD empty and leaves other methods and every other route to the application",async()=>{
 expect(await workerLiveness(new Request("https://lub.community/api/health",{method:"HEAD"}))!.text()).toBe("");
 for(const path of ["/account","/manage","/api/health/private","/api/health/"])expect(workerLiveness(new Request(`https://lub.community${path}`))).toBeNull();
 expect(workerLiveness(new Request("https://lub.community/api/health",{method:"POST"}))).toBeNull();
});

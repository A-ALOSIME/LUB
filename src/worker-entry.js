import handler from "vinext/server/fetch-handler";
import { DurableObject } from "cloudflare:workers";
import { setHyperdriveDatabaseUrl } from "./db/runtime-url";
import { workerLiveness } from "./worker-liveness";
import { dispatchRender } from "./renderer-dispatch";
import { secureSiteRequest } from "./transport-security";

// SSR runs on the free SQLite-backed object CPU budget. Storage is not used.
export class LUBRenderer extends DurableObject {
  fetch(request) {
    setHyperdriveDatabaseUrl(this.env.HYPERDRIVE.connectionString);
    return handler.fetch(request, this.env, this.ctx);
  }
}

const worker = {
  fetch(request, env) {
    return secureSiteRequest(request, () => {
      const liveness = workerLiveness(request);
      return liveness ?? dispatchRender(request, env.RENDERER);
    });
  },
};

export default worker;

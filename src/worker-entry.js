import handler from "vinext/server/fetch-handler";
import { setHyperdriveDatabaseUrl } from "./db/runtime-url";
import { workerLiveness } from "./worker-liveness";

const worker = {
  fetch(request, env, ctx) {
    const liveness = workerLiveness(request);
    if (liveness) return liveness;
    setHyperdriveDatabaseUrl(env.HYPERDRIVE.connectionString);
    return handler.fetch(request, env, ctx);
  },
};

export default worker;

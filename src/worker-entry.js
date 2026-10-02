import handler from "vinext/server/fetch-handler";
import { setHyperdriveDatabaseUrl } from "./db/runtime-url";

const worker = {
  fetch(request, env, ctx) {
    setHyperdriveDatabaseUrl(env.HYPERDRIVE.connectionString);
    return handler.fetch(request, env, ctx);
  },
};

export default worker;

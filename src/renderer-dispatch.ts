type RendererNamespace = {
  getByName(name: string, options: { locationHint: "weur" }): {
    fetch(request: Request): Promise<Response>;
  };
};

// Bounded concurrency, no per-user object names or persisted application data.
export function dispatchRender(
  request: Request,
  namespace: RendererNamespace,
  random = crypto.getRandomValues(new Uint8Array(1))[0],
) {
  return namespace.getByName(`render-${random % 4}`, { locationHint: "weur" }).fetch(request);
}

import { expect, it } from "vitest";
import { serializeJsonLd } from "./json-ld";

it("escapes script-closing markup in JSON-LD values", () => {
  const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });

  expect(serialized).not.toContain("</script>");
  expect(serialized).toContain("\\u003c/script>");
});

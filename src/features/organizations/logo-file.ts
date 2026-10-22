import { SaxesParser } from "saxes";

export const ORGANIZATION_LOGO_MAX_BYTES = 2 * 1024 * 1024;
const svgNamespace = "http://www.w3.org/2000/svg";
const svgTags = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polygon", "polyline",
  "defs", "linearGradient", "radialGradient", "stop", "clipPath", "title", "desc",
]);
const commonAttributes = new Set([
  "id", "transform", "opacity", "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset",
  "stroke-opacity", "vector-effect", "clip-path", "clip-rule",
]);
const elementAttributes: Record<string, ReadonlySet<string>> = {
  svg: new Set(["xmlns", "viewBox", "width", "height", "preserveAspectRatio"]),
  path: new Set(["d"]), rect: new Set(["x", "y", "width", "height", "rx", "ry"]),
  circle: new Set(["cx", "cy", "r"]), ellipse: new Set(["cx", "cy", "rx", "ry"]),
  line: new Set(["x1", "y1", "x2", "y2"]), polygon: new Set(["points"]), polyline: new Set(["points"]),
  linearGradient: new Set(["x1", "y1", "x2", "y2", "gradientUnits", "gradientTransform", "spreadMethod"]),
  radialGradient: new Set(["cx", "cy", "r", "fx", "fy", "fr", "gradientUnits", "gradientTransform", "spreadMethod"]),
  stop: new Set(["offset", "stop-color", "stop-opacity"]), clipPath: new Set(["clipPathUnits"]),
  g: new Set(), defs: new Set(), title: new Set(), desc: new Set(),
};
const styleAttributes = new Set(["opacity", "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "clip-path", "clip-rule", "vector-effect"]);
const numericValue = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px|%)?$/i;
const transformValue = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([0-9eE+.,\s-]+\)\s*)+$/;
const colorValue = /^(?:none|currentColor|transparent|black|white|#[0-9a-f]{3,8}|rgba?\([0-9.%+\s,/-]+\)|hsla?\([0-9.%+\s,/-]+\)|url\(#[A-Za-z_][\w.-]{0,79}\))$/i;
const pathValue = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/;
const pointsValue = /^[0-9eE+.,\s-]+$/;
const idValue = /^[A-Za-z_][A-Za-z0-9_.-]{0,79}$/;

function invalidSvg(): never {
  throw new Error("ملف SVG غير صالح أو يحتوي عناصر غير مسموحة.");
}

function validAttribute(tagName: string, name: string, value: string, root: boolean): boolean {
  if (name === "xmlns") return root && value === svgNamespace;
  if (name === "id") return idValue.test(value);
  if (name === "style") {
    const declarations = value.split(";").map(declaration => declaration.trim()).filter(Boolean);
    return declarations.length > 0 && declarations.every((declaration): boolean => {
      const separator = declaration.indexOf(":");
      if (separator < 1) return false;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const propertyValue = declaration.slice(separator + 1).trim();
      return styleAttributes.has(property) && validAttribute(tagName, property, propertyValue, root);
    });
  }
  if (!commonAttributes.has(name) && !elementAttributes[tagName]?.has(name)) return false;
  if (commonAttributes.has(name)) {
    if (["fill", "stroke", "clip-path"].includes(name)) return colorValue.test(value);
    if (["opacity", "fill-opacity", "stroke-opacity"].includes(name)) return numericValue.test(value) && Number.parseFloat(value) >= 0 && Number.parseFloat(value) <= 1;
    if (name === "transform") return transformValue.test(value);
    if (name === "stroke-linecap") return ["butt", "round", "square"].includes(value);
    if (name === "stroke-linejoin") return ["miter", "round", "bevel"].includes(value);
    if (name === "fill-rule" || name === "clip-rule") return ["nonzero", "evenodd"].includes(value);
    if (name === "vector-effect") return value === "none" || value === "non-scaling-stroke";
    if (name === "stroke-width" || name === "stroke-miterlimit" || name === "stroke-dashoffset") return numericValue.test(value);
    if (name === "stroke-dasharray") return value === "none" || /^[0-9eE+.,%\s-]+$/.test(value);
    return false;
  }
  if (name === "viewBox") return /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:[ ,]+[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?){3}\s*$/i.test(value);
  if (name === "d") return value.length <= 100_000 && pathValue.test(value);
  if (name === "points") return value.length <= 100_000 && pointsValue.test(value);
  if (["gradientUnits", "clipPathUnits"].includes(name)) return ["userSpaceOnUse", "objectBoundingBox"].includes(value);
  if (name === "spreadMethod") return ["pad", "reflect", "repeat"].includes(value);
  if (name === "gradientTransform") return transformValue.test(value);
  if (name === "preserveAspectRatio") return /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: meet| slice)?)$/.test(value);
  if (name === "offset") return numericValue.test(value) && Number.parseFloat(value) >= 0 && Number.parseFloat(value) <= 100;
  if (name === "stop-color") return colorValue.test(value) && !value.startsWith("url(");
  return numericValue.test(value);
}

function validateSvg(svg: string) {
  const parser = new SaxesParser({ xmlns: false });
  let rootCount = 0;
  let depth = 0;
  let nodeCount = 0;
  const ids = new Set<string>();
  const references = new Set<string>();
  parser.on("error", () => invalidSvg());
  parser.on("doctype", () => invalidSvg());
  parser.on("processinginstruction", () => invalidSvg());
  parser.on("opentag", tag => {
    depth++;
    nodeCount++;
    if (depth > 64 || nodeCount > 5_000 || !svgTags.has(tag.name)) invalidSvg();
    const root = depth === 1;
    if (root) {
      rootCount++;
      if (tag.name !== "svg") invalidSvg();
    }
    const attrs = tag.attributes as Record<string, string>;
    if (Object.keys(attrs).length > 40) invalidSvg();
    for (const [name, value] of Object.entries(attrs)) {
      if (value.length > 100_000 || !validAttribute(tag.name, name, value, root)) invalidSvg();
      if (name === "id") {
        if (ids.has(value)) invalidSvg();
        ids.add(value);
      }
      for (const match of value.matchAll(/url\(#([A-Za-z_][\w.-]{0,79})\)/g)) references.add(match[1]);
    }
    if (root && attrs.xmlns !== svgNamespace) invalidSvg();
  });
  parser.on("closetag", () => { depth--; });
  parser.write(svg).close();
  if (rootCount !== 1 || depth !== 0 || [...references].some(reference => !ids.has(reference))) invalidSvg();
}

export function inspectOrganizationLogo(bytes: Uint8Array): { mimeType: "image/png" | "image/svg+xml"; extension: "png" | "svg" } {
  if (bytes.byteLength < 8 || bytes.byteLength > ORGANIZATION_LOGO_MAX_BYTES) throw new Error("حجم الشعار يجب ألا يتجاوز 2 ميجابايت.");
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (pngSignature.every((value, index) => bytes[index] === value)) {
    if (bytes.byteLength < 24 || new TextDecoder().decode(bytes.slice(12, 16)) !== "IHDR") throw new Error("ملف PNG غير صالح.");
    const dimensions = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = dimensions.getUint32(16);
    const height = dimensions.getUint32(20);
    if (!width || !height || width > 4096 || height > 4096 || width * height > 16_000_000) throw new Error("أبعاد الشعار كبيرة جدًا.");
    return { mimeType: "image/png", extension: "png" };
  }
  let svg: string;
  try { svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("استخدم ملف PNG أو SVG بترميز UTF-8."); }
  if (!/^\s*(?:<\?xml\s[^?]*\?>\s*)?<svg(?:\s|>)/i.test(svg)) invalidSvg();
  validateSvg(svg);
  return { mimeType: "image/svg+xml", extension: "svg" };
}

export function isOrganizationImageUrl(value: string, organizationId: string, supabaseUrl: string): boolean {
  try {
    const url = new URL(value);
    const supabase = new URL(supabaseUrl);
    const filePattern = new RegExp(`^/storage/v1/object/public/lub-organization-logos/organizations/${organizationId}/[0-9a-f-]{36}\\.(?:png|svg)$`, "i");
    return url.protocol === "https:" && url.origin === supabase.origin && !url.search && !url.hash && filePattern.test(url.pathname);
  } catch {
    return false;
  }
}

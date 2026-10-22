import { expect, it } from "vitest";
import { inspectOrganizationLogo, isOrganizationImageUrl } from "./logo-file";

const bytes = (value: string) => new TextEncoder().encode(value);
const tinyPngHeader = () => {
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(png.buffer).setUint32(16, 1);
  new DataView(png.buffer).setUint32(20, 1);
  return png;
};

it("accepts a real PNG signature and a simple vector logo", () => {
  expect(inspectOrganizationLogo(tinyPngHeader()).mimeType).toBe("image/png");
  expect(inspectOrganizationLogo(bytes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#123456" d="M1 1h22v22H1z"/></svg>')).mimeType).toBe("image/svg+xml");
  expect(inspectOrganizationLogo(bytes('<svg xmlns="http://www.w3.org/2000/svg"><path style="fill: #123456; stroke-width: 2" d="M0 0h1"/></svg>')).mimeType).toBe("image/svg+xml");
});

it("rejects active SVG features, external resources, malformed XML, and oversized images", () => {
  const unsafe = [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://attacker.example/pixel"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x "bad">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill: url(https://attacker.example/a.svg#paint)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0"',
  ];
  for (const svg of unsafe) expect(() => inspectOrganizationLogo(bytes(svg))).toThrow();
  expect(() => inspectOrganizationLogo(new Uint8Array(2 * 1024 * 1024 + 1))).toThrow();
  expect(() => inspectOrganizationLogo(new Uint8Array([0, 1, 2, 3]))).toThrow();
});

it("only accepts partner images from this organization's public storage folder", () => {
  const organizationId = "123e4567-e89b-42d3-a456-426614174000";
  const url = `https://project.supabase.co/storage/v1/object/public/lub-organization-logos/organizations/${organizationId}/123e4567-e89b-42d3-a456-426614174001.png`;
  expect(isOrganizationImageUrl(url, organizationId, "https://project.supabase.co")).toBe(true);
  expect(isOrganizationImageUrl(url.replace(organizationId, "223e4567-e89b-42d3-a456-426614174000"), organizationId, "https://project.supabase.co")).toBe(false);
  expect(isOrganizationImageUrl(url.replace("project.supabase.co", "other.supabase.co"), organizationId, "https://project.supabase.co")).toBe(false);
  expect(isOrganizationImageUrl(`${url}?redirect=https://attacker.example`, organizationId, "https://project.supabase.co")).toBe(false);
});

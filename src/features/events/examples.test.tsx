// @vitest-environment jsdom
import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {EventExampleDetail, eventExamples} from "./examples";

vi.mock("next/image", () => ({default: ({src, alt}: {src: string; alt: string}) => <span data-image-src={src} data-alt={alt}/> }));
vi.mock("next/link", () => ({default: ({href, ...props}: React.ComponentProps<"a"> & {href: string}) => <a href={href} {...props}/> }));

afterEach(cleanup);

describe("event example details", () => {
  it("pairs every event detail title with an icon", () => {
    for (const example of eventExamples) {
      const {container, unmount} = render(<EventExampleDetail example={example} locale="ar"/>);
      const headings = Array.from(container.querySelectorAll(".event-example-detail-meta dt, .event-example-detail-section h2"));

      expect(headings).toHaveLength(example.facts.length + 1 + example.sections.length);
      expect(headings.every(heading => heading.querySelector(".event-icon"))).toBe(true);
      unmount();
    }
  });

  it("sizes each poster frame to its artwork and keeps the club lockup above the shared title", () => {
    for (const example of eventExamples) {
      const {container, unmount} = render(<EventExampleDetail example={example} locale="ar"/>);
      const heading = container.querySelector(".event-example-detail-heading");
      const organization = heading?.querySelector(".event-example-detail-organization");
      const title = heading?.querySelector(":scope > h1");

      expect(container.querySelector(".event-example-detail-art-frame")?.getAttribute("style")).toContain(`aspect-ratio: ${example.imageWidth} / ${example.imageHeight}`);
      expect(organization?.querySelector(".event-example-detail-organization-mark")).toBeTruthy();
      expect(organization?.contains(title ?? null)).toBe(false);
      expect(title?.classList.contains("event-example-detail-title")).toBe(true);
      expect(container.querySelectorAll(".event-example-detail-section ul li").length).toBe(example.sections.reduce((count, section) => count + section.items.length, 0));
      unmount();
    }
  });

  it("pairs the club identity with the title and groups event details into one connected area", () => {
    const example = eventExamples.find(item => item.id === "ieee");
    expect(example).toBeDefined();
    if (!example) return;

    const {container} = render(<EventExampleDetail example={example} locale="ar"/>);

    expect(screen.getByRole("heading", {level: 1, name: example.title.ar})).toBeTruthy();
    expect(container.querySelector(".event-example-detail")?.getAttribute("dir")).toBe("rtl");
    expect(container.querySelector(".event-example-detail-organization-mark [data-image-src]")?.getAttribute("data-image-src")).toBe(example.organizationLogo);
    expect(screen.getByText("طلاب وطالبات الجامعة")).toBeTruthy();
    const detailHeadings = Array.from(container.querySelectorAll(".event-example-detail-meta dt, .event-example-detail-section h2"));
    expect(detailHeadings).toHaveLength(example.facts.length + 1 + example.sections.length);
    expect(detailHeadings.every(heading => heading.querySelector(".event-icon"))).toBe(true);
    expect(container.querySelector(".event-example-detail-art-frame [data-image-src]")?.getAttribute("data-image-src")).toBe(example.image);
    const information = container.querySelector(".event-example-detail-information");
    expect(information?.contains(container.querySelector(".event-example-detail-meta"))).toBe(true);
    expect(information?.contains(container.querySelector(".event-example-detail-sections"))).toBe(true);
    expect(screen.getByRole("region", {name: "برنامج المعسكر"})).toBeTruthy();
    expect(screen.getByRole("region", {name: "متطلبات المشاركة"})).toBeTruthy();
    const application = screen.getByRole("region", {name: "التسجيل"});
    expect(container.querySelector(".event-example-detail-copy")?.contains(application)).toBe(true);
    expect(screen.getByRole("button", {name: "التقديم على الفعالية"}).hasAttribute("disabled")).toBe(true);
  });
});

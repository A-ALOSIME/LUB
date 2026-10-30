// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it} from "vitest";
import {OrganizationLogo} from "./organization-logo";
afterEach(cleanup);
it("keeps the complete mark in a square rounded frame and falls back to the first letter after a broken image",async()=>{
 const {container}=render(<OrganizationLogo name="مجلس الطلاب" src="/broken-logo.png"/>);
 const root=container.querySelector('[data-slot=avatar]')!,image=screen.getByAltText("مجلس الطلاب");
 expect(root.className).toContain("organization-logo");expect(root.className).toContain("rounded-lg");expect(root.className).not.toContain("rounded-full");expect(image.className).toContain("object-contain");expect(image.className).toContain("p-0");
 fireEvent.error(image);await waitFor(()=>expect(image.hasAttribute("data-error")).toBe(true));
 expect((image as HTMLImageElement).style.display).toBe("none");expect(screen.getByText("م").className).toContain("rounded-lg");expect(screen.getByText("م").getAttribute("dir")).toBe("auto");
 fireEvent.load(image);await waitFor(()=>expect(image.getAttribute("aria-hidden")).toBeNull());expect(screen.queryByText("م")).toBeNull();expect((image as HTMLImageElement).style.display).toBe("");
});
it("uses the same rounded first-letter fallback when no logo was provided",()=>{render(<OrganizationLogo name="IEEE"/>);expect(screen.getByText("I").closest('[data-slot=avatar]')?.className).toContain("rounded-lg");});

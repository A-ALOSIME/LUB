// @vitest-environment jsdom
import { expect, it } from "vitest";
import { navigationHistoryIndex } from "./navigation-history";

it("tracks traversal indices without extra entries or losing Next router state", () => {
  const push = history.pushState;
  const replace = history.replaceState;
  const length = history.length;
  try {
    replace.call(history, { __vinext_historyIndex: 0 }, "");
    expect(history.length).toBe(length);
    expect(navigationHistoryIndex()).toBe(0);
    history.pushState({ __NA: true, __vinext_historyIndex: 1, tree: ["route"] }, "", "/next");
    expect(history.length).toBe(length + 1);
    expect(navigationHistoryIndex()).toBe(1);
    expect(history.state.tree).toEqual(["route"]);
    history.replaceState({ __NA: true, __vinext_historyIndex: 1, tree: ["edited"] }, "", "/edited");
    expect(navigationHistoryIndex()).toBe(1);
    expect(history.state.tree).toEqual(["edited"]);
    expect(history.pushState).toBe(push);
    replace.call(history, { __vinext_historyIndex: 0 }, "", "/previous");
    expect(navigationHistoryIndex()).toBe(0);
  } finally {
    history.pushState = push;
    history.replaceState = replace;
    replace.call(history, null, "", "/");
  }
});

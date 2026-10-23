// @vitest-environment jsdom
import { expect, it } from "vitest";
import { installNavigationHistory, navigationHistoryIndex } from "./navigation-history";

it("tracks traversal indices without extra entries or losing Next router state", () => {
  const push = history.pushState;
  const replace = history.replaceState;
  const length = history.length;
  try {
    installNavigationHistory();
    expect(history.length).toBe(length);
    expect(navigationHistoryIndex()).toBe(0);
    history.pushState({ __NA: true, tree: ["route"] }, "", "/next");
    expect(history.length).toBe(length + 1);
    expect(navigationHistoryIndex()).toBe(1);
    expect(history.state.tree).toEqual(["route"]);
    history.replaceState({ __NA: true, tree: ["edited"] }, "", "/edited");
    expect(navigationHistoryIndex()).toBe(1);
    expect(history.state.tree).toEqual(["edited"]);
    const wrappedPush = history.pushState;
    installNavigationHistory();
    expect(history.pushState).toBe(wrappedPush);
    replace.call(history, { __lubHistoryIndex: 0 }, "", "/previous");
    expect(navigationHistoryIndex()).toBe(0);
  } finally {
    history.pushState = push;
    history.replaceState = replace;
    Reflect.deleteProperty(history, "__lubTrackerInstalled");
    replace.call(history, null, "", "/");
  }
});

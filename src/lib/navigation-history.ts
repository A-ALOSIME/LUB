"use client";

const indexKey = "__lubHistoryIndex";
type TrackedHistory = History & { __lubTrackerInstalled?: boolean };

function storedIndex() {
  const state: unknown = window.history.state;
  return state && typeof state === "object" && indexKey in state && typeof state[indexKey] === "number" ? state[indexKey] : undefined;
}

export function navigationHistoryIndex() {
  return window.navigation?.currentEntry?.index ?? storedIndex();
}

export function installNavigationHistory() {
  const history = window.history as TrackedHistory;
  if (history.__lubTrackerInstalled) return;
  const push = history.pushState;
  const replace = history.replaceState;
  const stamped = (state: unknown, index: number) => ({ ...(state && typeof state === "object" ? state : {}), [indexKey]: index });
  replace.call(history, stamped(history.state, storedIndex() ?? 0), "");
  // One document-lifetime wrapper. It preserves Next's state and adds no entries.
  // The fallback also covers browsers without the Navigation API.
  history.pushState = (state, title, url) => push.call(history, stamped(state, (storedIndex() ?? 0) + 1), title, url);
  history.replaceState = (state, title, url) => replace.call(history, stamped(state, storedIndex() ?? 0), title, url);
  Object.defineProperty(history, "__lubTrackerInstalled", { value: true, configurable: true });
}

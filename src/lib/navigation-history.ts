"use client";

export function navigationHistoryIndex() {
  const nativeIndex = window.navigation?.currentEntry?.index;
  if (typeof nativeIndex === "number" && nativeIndex >= 0) return nativeIndex;
  // vinext 1.1 writes history internally using saved native methods. Its own
  // traversal index remains correct for those writes and hash/tab navigation.
  const state: unknown = window.history.state;
  if (state && typeof state === "object" && "__vinext_historyIndex" in state && typeof state.__vinext_historyIndex === "number" && Number.isSafeInteger(state.__vinext_historyIndex) && state.__vinext_historyIndex >= 0) return state.__vinext_historyIndex;
  return undefined;
}

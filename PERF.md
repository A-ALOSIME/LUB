# Dashboard interaction checks — 29 October 2026

The authenticated production check used an existing student session without changing its records. Measurements include browser automation overhead; they are not Web Vitals or a guarantee for every device.

## Findings and retained changes

- Warm sidebar revisits were already fast (47–57 ms in the initial check), so no shared cache of account data or permissions was added.
- Personal request categories previously used a server navigation on each switch. Playwright click-to-selected-tab samples were 1350, 1023, 1224 and 899 ms.
- A 30-second dynamic router-cache setting did not reliably improve these requests (1461, 1122, 2497 and 1464 ms), so it was removed. The nonce-bearing root remains dynamic.
- Request categories now receive three bounded, owner-scoped panels in one parallel server read. Switching keeps these panels mounted and changes the URL through native history. It makes no router navigation or server-action call. The current category's filter/page URL is retained; browser back/forward and preview exit are covered by tests. Writes retain server authorization and page revalidation.
- Member/request tabs similarly reuse their two already-authorized panels.
- GET filter forms use a client transition instead of a document reload, debounce typing, skip an unchanged URL, and preserve native POST/server-action behavior.

## Interpreting the final timing

The final Playwright samples were 957, 996, 999 and 1005 ms. A native click measured 26 ms; repeated native click plus DOM reads measured 38, 28, 882 and 840 ms. The large variation and approximately one-second Playwright floor make a uniform percentage speedup unjustified. The retained improvement is the removal of repeated server navigation, verified in component tests and in the production UI: the loaded category changes immediately, its URL changes, and its content remains mounted. This does not claim a measured reduction in initial page-load time.

To repeat: open `/applications`, allow the initial page to load, alternate the join and renewal tabs, then use back/forward. For filters, change a search value and a select and confirm the layout stays mounted. Run `npm run check` and `npm run build` before publishing.

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

## Activity and notification cache increment

Before this increment, production `/activity` had one mounted tab panel and each tab switch used a server navigation. It now receives its three bounded, authorized datasets in parallel and keeps all panels mounted. A regression switches ten times, retains entered state and the current tab's filter URL, and asserts zero router navigation. Event/hour pagination no longer accidentally shares the active tab's page index.

Notification all/unread pages are both prefetched on first load and switched locally with native history. Individual and bulk read updates are optimistic; failures restore the previous state. Reading notifications no longer invalidates unrelated task, management, or activity pages. Bell and inbox tests cover cached opening and rollback.

Data freshness is separate from tab interaction: while the document is visible and online, an authenticated background check runs every 30 seconds (also on focus, with a 5-second throttle). One RLS-scoped SQL fingerprint covers the user's activity, memberships, permissions, hours and registrations. A changed fingerprint triggers a background router refresh; unchanged data keeps the mounted UI. These are freshness signals, not authorization decisions or shared private caches. Read-only production database checks succeeded: activity 478 ms and notifications 432 ms including connection/network overhead. This is not a page latency or CPU benchmark. No initial-load percentage claim is made.

Finite status-route categories are prefetched in parallel once per page/locale, never arbitrary search permutations, pagination ranges or filter Cartesian products. Component tests assert unique local URLs only. Server authorization and the fresh CSP nonce are preserved.

English editorial content uses a bundled saved dictionary rather than an external translation provider. It covers the current public club/council names, summaries and curated descriptions/sections. Display rendering never overwrites form inputs, Arabic source data, URLs or personal names. Unknown future user-authored text remains authored until an English translation is added; there is no automatic Google/DeepL service, key or recurring fee.

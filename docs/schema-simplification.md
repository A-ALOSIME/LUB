# Schema simplification

Status: implementation in an isolated local worktree and database. Never migrate the live database before the full cutover gates pass.

## Baseline and recovery

- Baseline commit: `082c0cd930af71b3735944b546130e72ef2e579e`.
- GitHub tag: `before-schema-simplification-20261106`.
- Local branch: `schema-simplification`; shared remote branch remains `main`.
- Private baseline directory: `C:/Users/AF9VI/Documents/LUB-backups/schema-simplification-20261106` (owner/System ACL only).
- Capture schema/functions/policies and account/profile/publication records separately. Do not export passwords, sessions, tokens or secret values. Other existing activity data is disposable, but prefer preserving accounts.
- The private `storage-policies-before.sql` snapshot contains 12 application Storage policies. Its SHA-256 is `98b8901f014b65b61bcfe435a74dfdff49f15b2ec4333676daef1899b112f575`. Replay succeeded against the restored baseline inside an isolated transaction.
- Recovery means restoring baseline code AND baseline database structure/functions and separately deployed functions. A Git revert alone is insufficient. Rehearse recovery on an empty isolated database before cutover.

## Accepted product changes

Remove automatic content translation (keep static i18n and manually stored English content), legacy permission grants, bulk undo (keep bulk decisions), application messages/internal notes, general audit log, independent task/form version archives, individual renewal exclusions, hours decision/adjustment history, task-template library (keep duplication), and special event contributions.

Keep optional public profiles, personal identifiers private, existing role scopes, committee memberships separate, self-reported hours, notifications, customized portfolio work, repeated/withdrawn submissions, forms/preview, event attendance, member/registrant XLSX and term/lifetime hour totals. The administrative hours tab becomes one scoped pending-approval queue plus self-request enable/disable, without general reporting/export. User clarification during implementation: include pending self-requests, deputy manual additions and task awards together so approvals cannot become stranded.

## Target: 18 application tables

| Table | Content moved inside |
|---|---|
| users | profile, publication settings, links, skills, notifications |
| private_student_identifiers | encrypted national/residency identifier remains separate |
| access_assignments | global and organization/committee role scope |
| organizations | links, interests, form library |
| committees | committee tree and descriptions |
| organization_memberships | period and typed hour entries |
| committee_memberships | independent committee periods |
| organization_opening_requests | opening requests and decisions |
| academic_terms | named term/date ranges |
| membership_campaigns | registration/renewal type and settings |
| membership_cases | join application/renewal response, immutable question snapshot and answers |
| organization_content | event/announcement type, event skills and attachment references |
| event_registrations | review/withdrawal/reapply/attendance and form answers |
| tasks | task details, skills and image reference |
| task_participants | submissions/reviews and customized portfolio presentation |
| skills | canonical bilingual names, aliases and static category code |
| assets | ASCII storage key, original display filename, owner/type/size |
| history_events | application, event registration and membership timelines |

Supabase-managed schemas are outside this count. No permanent compatibility tables/views disguising the old 62-table model. Historical migration files stay intact. Nested identifiers require database/server validation, per-owner write authorization and atomic updates. Public DTOs must never serialize complete user/organization records.

## Nested contracts implemented so far

- `organizations.forms`: entries contain `id`, `name`, optional `sourceFormId`, timestamps, and one `version` with the same entry ID, current optimistic `revision`, `status_code` and `definition`. No independent version archive. Library reads omit definitions except for the selected entry. Organization row locks serialize edits/deletion with campaign/content reference creation.
- Registration `membership_cases`: `form_snapshot` copies the exact definition/revision at submission. It is immutable even when the live form changes; editing answers uses the stored snapshot and response revision. `answers` retain question IDs; `attachments` use `{id: questionId, assetId}` so file-to-question association survives. Hidden answers are removed and cannot remain required. The database trigger rejects unknown answers, mismatched attachments and snapshot rewrites.
- `users.notifications`: entries use `id`, `typeCode`, `title`, `body`, `targetUrl`, `createdAt`, `readAt`. Writes occur inside the domain transaction, so a failed decision produces no orphan notification.
  The source feed/counts/freshness/read-all paths now use actor-only notification functions. Read receipts lock the user row and preserve existing receipts; concurrent domain appends wait and retain the new unread message. No separate notification table is recreated.
- `organization_memberships.hours`: entries contain UUID `id`, `committee_id`, `academic_term_id`, typed `source_code`/`source_id`, numeric `hours`, `activity_date`, description, current status/review/reviewer and timestamps. Corrections overwrite the current value/reason/reviewer, without decision/adjustment archive tables. Pending self-requests, deputy manual additions and task awards share one permission-scoped review queue. Its UI retains only the policy and pending decisions. The old hours export URL returns 410 to authenticated callers. The personal ledger keeps the authorized current value, term, reviewer and reason, and preserves withdrawal and filters. The task list and activity bootstrap now use the merged task, event, and membership records. Authenticated browser verification remains pending.
- `task_participants.submissions`: entries have UUID `id`, sequential `revision_number`, message, current decision/withdrawal metadata, `{id,assetId}` attachments and the task requirements/hours snapshot. Entries cannot be deleted or have their content/final decisions rewritten. Task edits do not change the snapshot's earned-hour amount. Approval and the unique task-source hour award share one transaction; a missing term rolls back approval, while student submission itself remains available. A deputy's work approval produces pending hours for an authorized approver.
- `assets`: original Arabic/English filenames remain display metadata, while new objects use owner UUID / asset UUID plus a trusted MIME extension. The existing 5 MiB and 30 uploads/day limits remain. Scoped file reads include the owner and authorized application/event/task reviewers; public media is limited to explicitly published images. Nested references lock asset rows and block metadata or object deletion, including concurrent deletion. Own unregistered objects remain removable after metadata failure. Download/preview routes now read the merged table; actual Supabase Storage HTTP testing remains a cutover gate.
- Pending registration cases are unique by campaign/student; renewal cases remain unique for every response state. A withdrawn application may be replaced, and an accepted student's ended membership permits a new application while keeping the old accepted case/history.
- Renewal campaigns create one case per eligible current member at publication, excluding leadership only when the campaign rule requests it. Pausing/resuming does not create duplicate invitations. Owner-only responses require an active invited membership and open period; closing finalizes only pending cases as no response. Archive restoration returns to closed, and a new independent campaign may use the same academic term. There is no individual-exclusion feature or table. Renewal-case reads are separate from application-review rights, so an HR deputy does not gain campaign access from application privileges alone.
- Announcement save/pin/archive/restore/delete operations use `organization_content` with `kind='Announcement'`. Public DTOs expose only published fields and public images, never draft/future/archived content. The source save/state repository is exercised against the merged schema; the surrounding organization/event overview reads still require conversion. Existing public-photo URL support must be retained when porting events, rather than interpreting every public image as a stored asset.
- Event lifecycle storage supports incomplete drafts, checked publication, cancellation, archive/restore, independent duplication, poster metadata and completion. Completion checks reviewed attendance and appends one `EVENT_ATTENDANCE` hour entry per eligible member using the event-end date in Riyadh. A missing term rolls back the operation. `public_photos` entries retain either a checked external HTTPS `url` or a stored `assetId`.
- Event registrations keep the original `form_snapshot`, cleaned `answers` and per-question attachments inline. Capacity and decisions are serialized with the event and organization. Reapplication retains the row and resets its prior review and attendance before a new decision. Bulk decisions are atomic. Attendance is accepted-only after the event. The native PostgreSQL probe registers, withdraws, reapplies and accepts through these APIs before advancing an isolated elapsed-event fixture to test attendance and completion.
- Event discovery, metadata, detail, private posters, student registration lists, and management editor/list/registrant repositories now read the merged schema. Event review reads only return full responses on demand. The management cache version uses content revisions and scoped registration state. Contribution recording and its filter were removed as agreed, and accepted registrants have a separate attendance action. Repository and component tests exercise these paths. Direct XLSX and authenticated HTTP/browser workflows remain cutover gates.
- The existing built-in skill catalog is copied from migration 0064 into `skills`; categories are constants in code. Profile selections retain ordered UUID references and at most five featured entries. Catalog search, custom aliases, owner-only selection changes and task/event skill assignment use the unified table. Public/own skill DTOs compute evidence from approved submissions and accepted present registrations of completed events, including completed events later archived. No manual evidence counts or per-skill publication flag. Real skill server actions are exercised against this contract; the full talent-page repository is still pending conversion.
- The combined rounds/campaigns list, renewal management bootstrap, student's own renewal invitations and registration workspace now read `membership_campaigns` and `membership_cases`. The registration workspace projects the current definition only for the selected editor. Pending invitations stay visible to their owner through closure and archive, and response availability uses the same membership, time and ownership rules as the write.
- The application page, submit/edit/withdraw and bulk actions, own request tabs, scoped review counts/detail, form list and preview now use the merged schema. A new submission carries the form revision, which is checked again inside the write transaction. Editing a submitted answer uses its response revision and original snapshot. Historical applications retain the reason and timeline. The shared workspace shell now reads account and scoped organization access from the merged schema. A standalone Chromium probe confirmed the anonymous registration route in eight locale/theme/viewport combinations. Authenticated browser flows remain a cutover gate.
- Task management and personal activity use scoped list/detail reads and a freshness fingerprint over the merged tables. A new task can publish or save as draft, and duplication creates an independent draft without participants or submissions. The template library and task revision history are removed. Earlier submissions retain their stored requirements internally for awards. A committee manager can edit tasks in permitted scopes but only read other students' submissions or decide within review scope. Retained file name metadata is returned only to authorized readers.
- Registration drafts permit missing dates/form and do not require an academic term; renewal campaigns require a term. Published registration requires a complete date interval and published form. Preserving this distinction avoids accidentally changing existing draft behavior when merging the campaign types.

- Public organization directory and detail read the merged organizations, campaigns and content with one scoped read each. The visitor projection includes only the public profile, organization links and public committees. Draft/future content and unpublished forms stay hidden. Leadership visibility follows the organization setting, and archived organization URLs still work. Saved English text is preferred for organization identity, committees, events, announcements and registration titles; original text remains available as fallback. Chromium verified the public list and detail in Arabic and English, light and dark, at four widths.

The 18-table contract has run in a loopback-only Supabase stack with Auth, Storage, PostgREST and Edge Runtime. Browser sign-in used one-time codes delivered to a local mail inbox. The student joined a task and uploaded Arabic and English filenames. The student and authorized leader downloaded both files and the outsider received 404. The leader approved the submission. Both scoped XLSX endpoints returned 200 through Edge and REST. Workbook verification opened the returned bytes and checked identifier strings and date cells.

Managed Storage already has RLS. The install asserts that invariant before adding application policies. It does not alter managed table ownership or enable RLS on the managed table. The contract was rehearsed in a rolled-back transaction as the local Supabase `postgres` role. The read-only production preflight confirmed 62 application tables and existing Storage RLS.

## Account migration rehearsal

After restoring the pinned baseline into the owned PostgreSQL sandbox, run `apply-contract.ts` with `LUB_REHEARSE_ACCOUNT_CUTOVER=yes` alongside the existing sandbox replacement flag and baseline-directory setting. This tests a student, an incomplete account and an administrator in one transaction. It preserves IDs, basic profile fields, public-profile slug and visibility, encrypted identifiers and administrator access. The Supabase Auth identities remain in their own schema.

The rehearsal always rolls back and verifies that the original 62-table schema is present afterward. `preserve-accounts18.sql` is the account-copy step. Live replacement still requires a reviewed account and content transfer scope, a fresh rollback artifact for application data and Storage policies, and coordinated database, Edge and Worker deployment.

## Cutover gates

1. Baseline tag and readable private schema/account export; isolated database guard and recovery rehearsal.
2. Real 18-table schema, constraints/RLS and role matrix; no authentication bypass.
3. Every retained workflow uses the new storage; removed features have explicit replacement/absence tests. Do not silence or skip failures.
4. `npm run check` and `npm run build`; actual browser AR/EN, RTL/LTR, dark/light and mobile; upload/review/withdraw/reapply/XLSX/security tests.
5. Fetch/reconcile latest main, commit and push exact verified source before deploying; verify deployed source/version and main match. Do not mutate live before all prior gates pass.

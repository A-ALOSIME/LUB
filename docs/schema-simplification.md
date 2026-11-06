# Schema simplification

Status: implementation in an isolated local worktree and database. Never migrate the live database before the full cutover gates pass.

## Baseline and recovery

- Baseline commit: `082c0cd930af71b3735944b546130e72ef2e579e`.
- GitHub tag: `before-schema-simplification-20261106`.
- Local branch: `schema-simplification`; shared remote branch remains `main`.
- Private baseline directory: `C:/Users/AF9VI/Documents/LUB-backups/schema-simplification-20261106` (owner/System ACL only).
- Capture schema/functions/policies and account/profile/publication records separately. Do not export passwords, sessions, tokens or secret values. Other existing activity data is disposable, but prefer preserving accounts.
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
- `organization_memberships.hours`: entries contain UUID `id`, `committee_id`, `academic_term_id`, typed `source_code`/`source_id`, numeric `hours`, `activity_date`, description, current status/review/reviewer and timestamps. Corrections overwrite the current value/reason/reviewer, without decision/adjustment archive tables. Pending self-requests, deputy manual additions and task awards share one permission-scoped review queue. Withdrawing/voiding retains the basic entry; no general administration history/export.
- `task_participants.submissions`: entries have UUID `id`, sequential `revision_number`, message, current decision/withdrawal metadata, `{id,assetId}` attachments and the task requirements/hours snapshot. Entries cannot be deleted or have their content/final decisions rewritten. Task edits do not change the snapshot's earned-hour amount. Approval and the unique task-source hour award share one transaction; a missing term rolls back approval, while student submission itself remains available. A deputy's work approval produces pending hours for an authorized approver.
- Pending registration cases are unique by campaign/student; renewal cases remain unique for every response state. A withdrawn application may be replaced, and an accepted student's ended membership permits a new application while keeping the old accepted case/history.
- Registration drafts permit missing dates/form and do not require an academic term; renewal campaigns require a term. Published registration requires a complete date interval and published form. Preserving this distinction avoids accidentally changing existing draft behavior when merging the campaign types.

The isolated SQL modules are a tested storage contract, not yet a production migration. Remaining repositories, scoped DTOs, storage HTTP services and retained workflow browser tests must be completed before cutover.

## Cutover gates

1. Baseline tag and readable private schema/account export; isolated database guard and recovery rehearsal.
2. Real 18-table schema, constraints/RLS and role matrix; no authentication bypass.
3. Every retained workflow uses the new storage; removed features have explicit replacement/absence tests. Do not silence or skip failures.
4. `npm run check` and `npm run build`; actual browser AR/EN, RTL/LTR, dark/light and mobile; upload/review/withdraw/reapply/XLSX/security tests.
5. Fetch/reconcile latest main, commit and push exact verified source before deploying; verify deployed source/version and main match. Do not mutate live before all prior gates pass.

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

Keep optional public profiles, personal identifiers private, existing role scopes, committee memberships separate, self-reported hours, notifications, customized portfolio work, repeated/withdrawn submissions, forms/preview, event attendance, member/registrant XLSX and term/lifetime hour totals. The administrative hours tab becomes pending self-request review plus enable/disable, without general reporting/export.

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

## Cutover gates

1. Baseline tag and readable private schema/account export; isolated database guard and recovery rehearsal.
2. Real 18-table schema, constraints/RLS and role matrix; no authentication bypass.
3. Every retained workflow uses the new storage; removed features have explicit replacement/absence tests. Do not silence or skip failures.
4. `npm run check` and `npm run build`; actual browser AR/EN, RTL/LTR, dark/light and mobile; upload/review/withdraw/reapply/XLSX/security tests.
5. Fetch/reconcile latest main, commit and push exact verified source before deploying; verify deployed source/version and main match. Do not mutate live before all prior gates pass.

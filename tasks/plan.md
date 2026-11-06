# Schema simplification implementation

Contract: `docs/schema-simplification.md`; approved discussion is preserved in Downloads/LUB-simplification-removals.md and LUB-simplification-merges-and-return.md.

- [x] Fetch/inspect origin/main and existing dirty worktrees; preserve them.
- [x] Create isolated local branch/worktree and push baseline tag to GitHub.
- [x] Capture and verify private schema/account baseline: 6 accounts/profiles; archive SHA256 75be19eb8fc9a72b9a8bf7a47479715b65c5389288e6586f1f6c2924ea7e641c.
- [x] Start isolated PostgreSQL database and rehearse baseline structure recovery: 62 tables, 271 functions, 79 policies restored. Actual Supabase Auth/Storage HTTP services are not yet configured or tested locally.
- [x] Record baseline check/build results: final infrastructure lint/types and 1023 tests/230 files passed; build passed on the unchanged retry required by the existing Next security advisory (no suppression or dependency change). Baseline recovery and isolation are verified; retained application workflows still use the old schema at this checkpoint.
- [ ] Prove 18-table schema and scoped security on an isolated database.
- [ ] Convert account/profile/roles/skills and manual bilingual content.
- [ ] Convert organizations/forms/campaigns/applications/renewals/history.
- [ ] Convert content/events/attendance/attachments and direct XLSX.
- [ ] Convert tasks/participants/submissions/portfolio/hours/notifications.
- [ ] Remove obsolete UI/code/RPCs; update retained workflow tests without weakening the quality bar.
- [ ] Full checks/build/browser and recovery tests, review, merge and deployment verification.

Live service tests and local tests must be reported separately. Production is unchanged until cutover gates pass. Never load a production DATABASE_URL into the sandbox environment.

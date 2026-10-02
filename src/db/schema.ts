import { sql } from "drizzle-orm";
import { pgSchema, uuid, varchar, text, boolean, timestamp, jsonb, check, index, date, uniqueIndex, unique, foreignKey, primaryKey, integer, numeric, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { FormDefinition, Answers } from "@/features/forms/definition";

// Keep private identity data outside Supabase's default exposed public schema.
export const lub = pgSchema("lub");
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = lub.table("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  phone: varchar("phone", { length: 16 }).unique(),
  statusCode: varchar("status_code", { length: 20 }).notNull().default("Active"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [check("users_status_check", sql`${table.statusCode} in ('Active', 'Inactive')`)]).enableRLS();

export const studentProfiles = lub.table("student_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
  fullNameAr: varchar("full_name_ar", { length: 120 }).notNull(),
  universityIdCiphertext: text("university_id_ciphertext").notNull(),
  universityIdLookupHash: varchar("university_id_lookup_hash", { length: 64 }).notNull().unique(),
  majorName: varchar("major_name", { length: 120 }).notNull(),
  academicLevel: varchar("academic_level", { length: 20 }).notNull(),
  bio:varchar("bio",{length:1000}).notNull().default(""),
  createdAt: createdAt(), updatedAt: updatedAt(),
}).enableRLS();

export const profileSettings = lub.table("profile_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
  // Requirements say optional; default to opt-in, even before public profiles ship.
  publicProfileEnabled: boolean("public_profile_enabled").notNull().default(false),
  showTotalHours: boolean("show_total_hours").notNull().default(true),
  showRoleHistory: boolean("show_role_history").notNull().default(true),
  showEvents:boolean("show_events").notNull().default(true),
  showProjects:boolean("show_projects").notNull().default(true),
  updatedAt: updatedAt(),
}).enableRLS();

export const auditLog = lub.table("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  actionCode: varchar("action_code", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
  // Only non-sensitive flags; never serialize a full form or profile here.
  metadata: jsonb("metadata").$type<Record<string, boolean>>().notNull().default({}),
  createdAt: createdAt(),
}, (table) => [index("audit_actor_time_idx").on(table.actorUserId, table.createdAt)]).enableRLS();

export const organizations = lub.table("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  typeCode: varchar("type_code", { length: 20 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  summary: text("summary").notNull().default(""),
  mission: text("mission").notNull().default(""),
  logoUrl: text("logo_url").notNull().default(""),
  statusCode: varchar("status_code", { length: 20 }).notNull().default("Active"),
  showLeadershipPublicly: boolean("show_leadership_publicly").notNull().default(true),
  selfReportHoursEnabled: boolean("self_report_hours_enabled").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [
  check("org_type_check", sql`${t.typeCode} in ('Club', 'Council')`),
  check("org_status_check", sql`${t.statusCode} in ('Active', 'Inactive', 'Archived')`),
  check("org_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  check("org_logo_url_check", sql`${t.logoUrl} = '' or (${t.logoUrl} ~ '^https://[^[:space:]@]+$' and char_length(${t.logoUrl}) <= 2048)`),
  check("org_archive_check", sql`(${t.statusCode} = 'Archived') = (${t.archivedAt} is not null)`),
  check("org_text_check", sql`char_length(${t.nameAr}) between 2 and 120 and char_length(${t.summary}) <= 1000 and char_length(${t.mission}) <= 3000`),
  index("org_status_name_idx").on(t.statusCode, t.nameAr),
]).enableRLS();

export const tags = lub.table("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameAr: varchar("name_ar", { length: 40 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();
export const organizationTags = lub.table("organization_tags", {
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }),
}, t => [primaryKey({ columns: [t.organizationId, t.tagId] })]).enableRLS();
export const organizationLinks = lub.table("organization_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  linkType: varchar("link_type", { length: 80 }).notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, t => [check("org_link_https_check", sql`${t.url} ~ '^https://[^[:space:]]+$' and char_length(${t.url}) <= 2048`)]).enableRLS();

export const announcements = lub.table("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  title: varchar("title", { length: 120 }).notNull(),
  body: text("body").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [check("announcement_content_check", sql`char_length(trim(${t.title})) between 2 and 120 and char_length(${t.body}) between 1 and 5000`), check("announcement_pin_check", sql`${t.pinnedAt} is null or (${t.publishedAt} is not null and ${t.archivedAt} is null)`), uniqueIndex("announcement_one_pin_idx").on(t.organizationId).where(sql`${t.pinnedAt} is not null`), index("announcement_public_idx").on(t.organizationId,t.publishedAt,t.id).where(sql`${t.publishedAt} is not null and ${t.archivedAt} is null`)]).enableRLS();

export const committees = lub.table("committees", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  isPublic: boolean("is_public").notNull().default(true),
  statusCode: varchar("status_code", { length: 20 }).notNull().default("Active"),
  copiedFromCommitteeId: uuid("copied_from_committee_id").references((): AnyPgColumn => committees.id, { onDelete: "restrict" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [
  unique("committee_org_identity_unique").on(t.id, t.organizationId),
  check("committee_status_check", sql`${t.statusCode} in ('Active', 'Archived')`),
  check("committee_archive_check", sql`(${t.statusCode} = 'Archived') = (${t.archivedAt} is not null)`),
  check("committee_text_check", sql`char_length(${t.name}) between 2 and 120 and char_length(${t.description}) <= 2000`),
  index("committee_org_idx").on(t.organizationId),
]).enableRLS();

export const organizationMemberships = lub.table("organization_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  statusCode: varchar("status_code", { length: 20 }).notNull().default("Active"),
  startDate: date("start_date").notNull().default(sql`current_date`),
  endDate: date("end_date"),
  endedReason: text("ended_reason"),
  // FK is added after application tables in the security migration (circular history link).
  sourceApplicationId: uuid("source_application_id"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [
  unique("membership_org_identity_unique").on(t.id, t.organizationId),
  uniqueIndex("one_active_membership_idx").on(t.organizationId, t.userId).where(sql`${t.statusCode} = 'Active' and ${t.endDate} is null`),
  check("membership_status_check", sql`${t.statusCode} in ('Active', 'Inactive', 'Ended')`),
  check("membership_dates_check", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
  check("membership_ended_check", sql`${t.statusCode} <> 'Ended' or ${t.endDate} is not null`),
]).enableRLS();

export const globalRoleAssignments = lub.table("global_role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  roleCode: varchar("role_code", { length: 10 }).notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull().defaultNow(),
  endAt: timestamp("end_at", { withTimezone: true }),
  assignedByUserId: uuid("assigned_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
}, t => [
  check("global_role_code_check", sql`${t.roleCode} = 'SA'`),
  check("global_role_dates_check", sql`${t.endAt} is null or ${t.endAt} >= ${t.startAt}`),
  uniqueIndex("one_current_sa_assignment_idx").on(t.userId).where(sql`${t.endAt} is null`),
]).enableRLS();

export const roleAssignments = lub.table("role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationMembershipId: uuid("organization_membership_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  committeeId: uuid("committee_id"),
  roleCode: varchar("role_code", { length: 10 }).notNull(),
  isPrimaryLeader: boolean("is_primary_leader").notNull().default(false),
  startDate: date("start_date").notNull().default(sql`current_date`),
  endDate: date("end_date"),
  assignedByUserId: uuid("assigned_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
}, t => [
  foreignKey({ columns: [t.organizationMembershipId, t.organizationId], foreignColumns: [organizationMemberships.id, organizationMemberships.organizationId] }),
  foreignKey({ columns: [t.committeeId, t.organizationId], foreignColumns: [committees.id, committees.organizationId] }),
  check("role_scope_check", sql`(${t.roleCode} in ('OL','OD') and ${t.committeeId} is null) or (${t.roleCode} in ('CL','CD') and ${t.committeeId} is not null)`),
  check("role_primary_check", sql`${t.isPrimaryLeader} = (${t.roleCode} = 'OL')`),
  check("role_dates_check", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
  uniqueIndex("one_primary_leader_idx").on(t.organizationId).where(sql`${t.isPrimaryLeader} and ${t.endDate} is null`),
  index("role_membership_idx").on(t.organizationMembershipId),
]).enableRLS();

export const permissionGrants = lub.table("permission_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationMembershipId: uuid("organization_membership_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  committeeId: uuid("committee_id"),
  permissionCode: varchar("permission_code", { length: 80 }).notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull().defaultNow(),
  endAt: timestamp("end_at", { withTimezone: true }),
  grantedByUserId: uuid("granted_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
}, t => [
  foreignKey({ columns: [t.organizationMembershipId, t.organizationId], foreignColumns: [organizationMemberships.id, organizationMemberships.organizationId] }),
  foreignKey({ columns: [t.committeeId, t.organizationId], foreignColumns: [committees.id, committees.organizationId] }),
  check("grant_code_check", sql`${t.permissionCode} in ('ORG_PROFILE_MANAGE','COMMITTEE_MANAGE','COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','FORMS_MANAGE','REGISTRATION_ROUNDS_MANAGE','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','PERMISSIONS_GRANT','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','RENEWALS_MANAGE','REPORTS_GENERATE','EVENTS_MANAGE','EVENT_ATTENDANCE_MANAGE','EVENT_CONTRIBUTIONS_MANAGE')`),
  check("grant_scope_check", sql`${t.committeeId} is null or ${t.permissionCode} in ('COMMITTEE_PROFILE_MANAGE','MEMBERS_VIEW','APPLICATIONS_VIEW','APPLICATIONS_REVIEW','APPLICATIONS_BULK_ACTION','TASKS_MANAGE','TASK_TEMPLATES_MANAGE','HOUR_RULES_MANAGE','HOURS_APPROVE','HOURS_MANUAL_ADD','REPORTS_GENERATE')`),
  check("grant_dates_check", sql`${t.endAt} is null or ${t.endAt} > ${t.startAt}`),
  index("grant_membership_idx").on(t.organizationMembershipId),
]).enableRLS();

export const formTemplates = lub.table("form_templates", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").references(() => organizations.id),
  name: varchar("name", { length: 120 }).notNull(), purposeCode: varchar("purpose_code", { length: 20 }).notNull().default("Membership"),
  sourceTemplateId: uuid("source_template_id").references((): AnyPgColumn => formTemplates.id),
  isSystemTemplate: boolean("is_system_template").notNull().default(false), statusCode: varchar("status_code", { length: 20 }).notNull().default("Active"), createdAt: createdAt(),
}, t => [check("template_owner_check", sql`${t.isSystemTemplate} = (${t.organizationId} is null)`), check("template_status_check", sql`${t.statusCode} in ('Active','Archived')`), check("template_purpose_check", sql`${t.purposeCode} = 'Membership'`), check("template_name_check", sql`length(trim(${t.name})) between 2 and 120`), index("template_org_idx").on(t.organizationId)]).enableRLS();

export const formVersions = lub.table("form_versions", {
  id: uuid("id").primaryKey().defaultRandom(), formTemplateId: uuid("form_template_id").notNull().references(() => formTemplates.id),
  versionNumber: integer("version_number").notNull(), statusCode: varchar("status_code", { length: 20 }).notNull().default("Draft"),
  definition: jsonb("definition").$type<FormDefinition>().notNull(), revision: integer("revision").notNull().default(1), publishedAt: timestamp("published_at", { withTimezone: true }), createdAt: createdAt(),
}, t => [unique("form_version_number_unique").on(t.formTemplateId, t.versionNumber), uniqueIndex("one_form_draft_idx").on(t.formTemplateId).where(sql`${t.statusCode}='Draft'`), check("form_version_status_check", sql`${t.statusCode} in ('Draft','Published','Retired')`), check("form_version_number_check", sql`${t.versionNumber}>0 and ${t.revision}>0`), check("form_definition_size_check", sql`jsonb_typeof(${t.definition})='object' and octet_length(${t.definition}::text)<=128000`)]).enableRLS();

export const registrationRounds = lub.table("registration_rounds", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  formTemplateId: uuid("form_template_id").notNull().references(() => formTemplates.id), title: varchar("title", { length: 120 }).notNull(),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(), closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  statusCode: varchar("status_code", { length: 20 }).notNull().default("Draft"), allowWithdrawal: boolean("allow_withdrawal").notNull().default(true), createdAt: createdAt(),
}, t => [check("round_status_check", sql`${t.statusCode} in ('Draft','Open','Closed','Archived')`), check("round_dates_check", sql`${t.closesAt}>${t.opensAt}`), check("round_title_check", sql`length(trim(${t.title})) between 2 and 120`), index("round_org_status_idx").on(t.organizationId, t.statusCode)]).enableRLS();

export const formResponses = lub.table("form_responses", {
  id: uuid("id").primaryKey().defaultRandom(), formVersionId: uuid("form_version_id").notNull().references(() => formVersions.id),
  respondentUserId: uuid("respondent_user_id").notNull().references(() => users.id), answers: jsonb("answers").$type<Answers>().notNull(),
  revision: integer("revision").notNull().default(1), submittedAt: createdAt(), lastEditedAt: updatedAt(),
}, t => [check("response_answers_check", sql`jsonb_typeof(${t.answers})='object' and octet_length(${t.answers}::text)<=256000`), check("response_revision_check", sql`${t.revision}>0`), index("response_user_idx").on(t.respondentUserId)]).enableRLS();

export const membershipApplications = lub.table("membership_applications", {
  statusRevision: integer("status_revision").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(), registrationRoundId: uuid("registration_round_id").notNull().references(() => registrationRounds.id),
  applicantUserId: uuid("applicant_user_id").notNull().references(() => users.id), requestedCommitteeId: uuid("requested_committee_id").references(() => committees.id),
  formResponseId: uuid("form_response_id").notNull().unique().references(() => formResponses.id),
  statusCode: varchar("status_code", { length: 20 }).notNull().default("Submitted"), submittedAt: createdAt(),
  decidedAt: timestamp("decided_at", { withTimezone: true }), decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
  acceptedMembershipId: uuid("accepted_membership_id").unique().references(() => organizationMemberships.id),
}, t => [unique("one_application_per_round").on(t.registrationRoundId, t.applicantUserId), check("application_status_check", sql`${t.statusCode} in ('Submitted','Interview','Accepted','Rejected','Withdrawn')`), check("application_membership_check", sql`(${t.statusCode}='Accepted')=(${t.acceptedMembershipId} is not null)`), index("application_round_status_idx").on(t.registrationRoundId, t.statusCode), index("application_user_time_idx").on(t.applicantUserId, t.submittedAt)]).enableRLS();

export const committeeMemberships = lub.table("committee_memberships", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull(), organizationMembershipId: uuid("organization_membership_id").notNull(), committeeId: uuid("committee_id").notNull(),
  statusCode: varchar("status_code", { length: 20 }).notNull().default("Active"), startDate: date("start_date").notNull().default(sql`current_date`), endDate: date("end_date"), createdAt: createdAt(),
}, t => [foreignKey({ columns: [t.organizationMembershipId, t.organizationId], foreignColumns: [organizationMemberships.id, organizationMemberships.organizationId] }), foreignKey({ columns: [t.committeeId, t.organizationId], foreignColumns: [committees.id, committees.organizationId] }), check("committee_membership_status_check", sql`${t.statusCode} in ('Active','Ended')`), check("committee_membership_dates_check", sql`${t.endDate} is null or ${t.endDate}>=${t.startDate}`), check("committee_membership_end_check", sql`${t.statusCode}<>'Ended' or ${t.endDate} is not null`), uniqueIndex("one_active_committee_period_idx").on(t.organizationMembershipId, t.committeeId).where(sql`${t.statusCode}='Active' and ${t.endDate} is null`)]).enableRLS();

export const applicationInternalNotes = lub.table("application_internal_notes", {
  id: uuid("id").primaryKey().defaultRandom(), applicationId: uuid("application_id").notNull().references(() => membershipApplications.id), authorUserId: uuid("author_user_id").notNull().references(() => users.id), body: text("body").notNull(), createdAt: createdAt(),
}, t => [check("internal_note_body_check", sql`length(trim(${t.body})) between 1 and 3000`), index("internal_note_application_idx").on(t.applicationId)]).enableRLS();

export const applicationMessages = lub.table("application_messages", {
  id: uuid("id").primaryKey().defaultRandom(), applicationId: uuid("application_id").notNull().references(() => membershipApplications.id), senderUserId: uuid("sender_user_id").notNull().references(() => users.id), messageTypeCode: varchar("message_type_code", { length: 20 }).notNull().default("Interview"), body: text("body").notNull(), sentAt: createdAt(),
}, t => [check("application_message_body_check", sql`length(trim(${t.body})) between 1 and 3000`), check("application_message_type_check", sql`${t.messageTypeCode}='Interview'`), index("message_application_idx").on(t.applicationId)]).enableRLS();

export const bulkActions = lub.table("bulk_actions", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organizations.id), actionTypeCode: varchar("action_type_code", { length: 20 }).notNull(), executedByUserId: uuid("executed_by_user_id").notNull().references(() => users.id), executedAt: createdAt(), undoneAt: timestamp("undone_at", { withTimezone: true }), undoneByUserId: uuid("undone_by_user_id").references(() => users.id),
}, t => [check("bulk_action_type_check", sql`${t.actionTypeCode} in ('Accepted','Rejected','Interview')`), index("bulk_org_time_idx").on(t.organizationId, t.executedAt)]).enableRLS();

export const applicationStatusHistory = lub.table("application_status_history", {
  id: uuid("id").primaryKey().defaultRandom(), applicationId: uuid("application_id").notNull().references(() => membershipApplications.id), fromStatusCode: varchar("from_status_code", { length: 20 }), toStatusCode: varchar("to_status_code", { length: 20 }).notNull(), changedByUserId: uuid("changed_by_user_id").notNull().references(() => users.id), bulkActionId: uuid("bulk_action_id").references(() => bulkActions.id), changedAt: createdAt(), reason: varchar("reason", { length: 80 }),
}, t => [index("application_history_time_idx").on(t.applicationId, t.changedAt)]).enableRLS();

export const bulkActionItems = lub.table("bulk_action_items", {
  expectedStatusRevision: integer("expected_status_revision").notNull(),
  bulkActionId: uuid("bulk_action_id").notNull().references(() => bulkActions.id), applicationId: uuid("application_id").notNull().references(() => membershipApplications.id), previousStatusCode: varchar("previous_status_code", { length: 20 }).notNull(), newStatusCode: varchar("new_status_code", { length: 20 }).notNull(), createdMembershipId: uuid("created_membership_id").references(() => organizationMemberships.id), undoResultCode: varchar("undo_result_code", { length: 30 }),
}, t => [primaryKey({ columns: [t.bulkActionId, t.applicationId] })]).enableRLS();

export const applicationAssets = lub.table("application_assets", {
  id: uuid("id").primaryKey().defaultRandom(), ownerUserId: uuid("owner_user_id").notNull().references(() => users.id), objectKey: text("object_key").notNull().unique(), fileName: varchar("file_name", { length: 120 }).notNull(), mimeType: varchar("mime_type", { length: 40 }).notNull(), sizeBytes: integer("size_bytes").notNull(), createdAt: createdAt(),
}, t => [check("application_asset_type_check", sql`${t.mimeType} in ('application/pdf','image/jpeg','image/png')`), check("application_asset_size_check", sql`${t.sizeBytes} between 1 and 5242880`), check("application_asset_key_check", sql`${t.objectKey} ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'`), index("application_asset_owner_idx").on(t.ownerUserId, t.createdAt)]).enableRLS();

export const formResponseAssets = lub.table("form_response_assets", {
  formResponseId: uuid("form_response_id").notNull().references(() => formResponses.id), assetId: uuid("asset_id").notNull().references(() => applicationAssets.id), fieldId: uuid("field_id").notNull(),
}, t => [primaryKey({ columns: [t.formResponseId, t.assetId, t.fieldId] })]).enableRLS();

export const taskTemplates = lub.table("task_templates", {
 id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(()=>organizations.id), committeeId: uuid("committee_id"),
 name: varchar("name",{length:120}).notNull(), descriptionTemplate:text("description_template").notNull(), defaultHours:numeric("default_hours",{precision:6,scale:2}).notNull().default("0"),
 isActive:boolean("is_active").notNull().default(true), copiedFromTemplateId:uuid("copied_from_template_id").references(():AnyPgColumn=>taskTemplates.id), revision:integer("revision").notNull().default(1), createdAt:createdAt(),
},t=>[foreignKey({columns:[t.committeeId,t.organizationId],foreignColumns:[committees.id,committees.organizationId]}),check("task_template_text_check",sql`length(trim(${t.name})) between 2 and 120 and length(${t.descriptionTemplate}) between 1 and 6000`),check("task_template_hours_check",sql`${t.defaultHours} between 0 and 1000 and ${t.revision}>0`),index("task_template_scope_idx").on(t.organizationId,t.committeeId)]).enableRLS();
export const tasks = lub.table("tasks",{
 id:uuid("id").primaryKey().defaultRandom(),organizationId:uuid("organization_id").notNull().references(()=>organizations.id),committeeId:uuid("committee_id"),eventId:uuid("event_id"),taskTemplateId:uuid("task_template_id").references(()=>taskTemplates.id),createdByUserId:uuid("created_by_user_id").notNull().references(()=>users.id),
 title:varchar("title",{length:120}).notNull(),description:text("description").notNull(),startsAt:timestamp("starts_at",{withTimezone:true}),dueAt:timestamp("due_at",{withTimezone:true}),defaultHours:numeric("default_hours",{precision:6,scale:2}).notNull().default("0"),
 statusCode:varchar("status_code",{length:20}).notNull().default("Draft"),revision:integer("revision").notNull().default(1),closedAt:timestamp("closed_at",{withTimezone:true}),createdAt:createdAt(),updatedAt:updatedAt(),
},t=>[foreignKey({columns:[t.eventId,t.organizationId],foreignColumns:[events.id,events.organizationId]}),index("task_event_idx").on(t.eventId),foreignKey({columns:[t.committeeId,t.organizationId],foreignColumns:[committees.id,committees.organizationId]}),check("task_text_check",sql`length(trim(${t.title})) between 2 and 120 and length(trim(${t.description})) between 1 and 6000`),check("task_state_check",sql`${t.statusCode} in ('Draft','Open','Completed','Cancelled') and (${t.statusCode} in ('Completed','Cancelled'))=(${t.closedAt} is not null)`),check("task_bounds_check",sql`${t.defaultHours} between 0 and 1000 and ${t.revision}>0 and (${t.startsAt} is null or ${t.dueAt} is null or ${t.dueAt}>${t.startsAt})`),index("task_scope_status_idx").on(t.organizationId,t.committeeId,t.statusCode)]).enableRLS();
export const taskRevisions=lub.table("task_revisions",{
 id:uuid("id").primaryKey().defaultRandom(),taskId:uuid("task_id").notNull().references(()=>tasks.id),revisionNumber:integer("revision_number").notNull(),snapshotJson:jsonb("snapshot_json").notNull(),changedByUserId:uuid("changed_by_user_id").notNull().references(()=>users.id),changedAt:timestamp("changed_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[unique("task_revision_unique").on(t.taskId,t.revisionNumber)]).enableRLS();
export const taskParticipants=lub.table("task_participants",{
 id:uuid("id").primaryKey().defaultRandom(),taskId:uuid("task_id").notNull().references(()=>tasks.id),organizationMembershipId:uuid("organization_membership_id").notNull().references(()=>organizationMemberships.id),userId:uuid("user_id").notNull().references(()=>users.id),
 statusCode:varchar("status_code",{length:20}).notNull().default("Joined"),joinedAt:timestamp("joined_at",{withTimezone:true}).notNull().defaultNow(),closedAt:timestamp("closed_at",{withTimezone:true}),reviewedByUserId:uuid("reviewed_by_user_id").references(()=>users.id),approvedHoursOverride:numeric("approved_hours_override",{precision:6,scale:2}),
},t=>[unique("task_user_unique").on(t.taskId,t.userId),check("task_participant_state_check",sql`${t.statusCode} in ('Joined','In_Progress','Submitted','Approved','Closed') and (${t.statusCode} in ('Approved','Closed'))=(${t.closedAt} is not null)`),check("task_participant_hours_check",sql`${t.approvedHoursOverride} is null or ${t.approvedHoursOverride} between 0 and 1000`)]).enableRLS();
export const taskSubmissions=lub.table("task_submissions",{
 id:uuid("id").primaryKey().defaultRandom(),taskParticipantId:uuid("task_participant_id").notNull().references(()=>taskParticipants.id),taskRevisionId:uuid("task_revision_id").notNull().references(()=>taskRevisions.id),revisionNumber:integer("revision_number").notNull(),message:text("message").notNull(),statusCode:varchar("status_code",{length:20}).notNull().default("Submitted"),submittedAt:timestamp("submitted_at",{withTimezone:true}).notNull().defaultNow(),reviewedAt:timestamp("reviewed_at",{withTimezone:true}),reviewedByUserId:uuid("reviewed_by_user_id").references(()=>users.id),reviewNote:text("review_note"),
},t=>[unique("task_submission_revision_unique").on(t.taskParticipantId,t.revisionNumber),uniqueIndex("one_pending_task_submission_idx").on(t.taskParticipantId).where(sql`${t.statusCode}='Submitted'`),check("task_submission_state_check",sql`${t.statusCode} in ('Submitted','Approved','Rejected') and (${t.statusCode}<>'Submitted')=(${t.reviewedAt} is not null) and (${t.statusCode}<>'Submitted')=(${t.reviewedByUserId} is not null)`),check("task_submission_text_check",sql`length(${t.message})<=6000 and length(coalesce(${t.reviewNote},''))<=3000 and ${t.revisionNumber}>0`)]).enableRLS();
export const taskSubmissionAssets=lub.table("task_submission_assets",{taskSubmissionId:uuid("task_submission_id").notNull().references(()=>taskSubmissions.id),assetId:uuid("asset_id").notNull().references(()=>applicationAssets.id)},t=>[primaryKey({columns:[t.taskSubmissionId,t.assetId]})]).enableRLS();
export const notifications=lub.table("notifications",{
 id:uuid("id").primaryKey().defaultRandom(),recipientUserId:uuid("recipient_user_id").notNull().references(()=>users.id),typeCode:varchar("type_code",{length:40}).notNull(),title:varchar("title",{length:120}).notNull(),body:text("body").notNull(),targetUrl:text("target_url").notNull(),createdAt:createdAt(),readAt:timestamp("read_at",{withTimezone:true}),
},t=>[index("notification_recipient_time_idx").on(t.recipientUserId,t.createdAt),check("notification_target_check",sql`${t.targetUrl} ~ '^/(tasks|events)/[0-9a-f-]{36}$' or ${t.targetUrl} in ('/hours','/renewals')`)]).enableRLS();

export const academicTerms=lub.table("academic_terms",{
 id:uuid("id").primaryKey().defaultRandom(),academicYear:varchar("academic_year",{length:20}).notNull(),termCode:varchar("term_code",{length:20}).notNull(),nameAr:varchar("name_ar",{length:120}).notNull(),startDate:date("start_date").notNull(),endDate:date("end_date").notNull(),
},t=>[unique("academic_term_identity_unique").on(t.academicYear,t.termCode),check("academic_term_bounds_check",sql`${t.endDate}>=${t.startDate} and length(trim(${t.nameAr})) between 2 and 120 and length(trim(${t.academicYear})) between 2 and 20 and length(trim(${t.termCode})) between 1 and 20`),index("academic_term_dates_idx").on(t.startDate,t.endDate)]).enableRLS();
export const hourRules=lub.table("hour_rules",{
 id:uuid("id").primaryKey().defaultRandom(),organizationId:uuid("organization_id").notNull().references(()=>organizations.id),committeeId:uuid("committee_id"),taskTemplateId:uuid("task_template_id").references(()=>taskTemplates.id),name:varchar("name",{length:120}).notNull(),defaultHours:numeric("default_hours",{precision:6,scale:2}).notNull(),isActive:boolean("is_active").notNull().default(true),effectiveFrom:date("effective_from").notNull(),effectiveTo:date("effective_to"),revision:integer("revision").notNull().default(1),
},t=>[foreignKey({columns:[t.committeeId,t.organizationId],foreignColumns:[committees.id,committees.organizationId]}),check("hour_rule_bounds_check",sql`${t.defaultHours} between 0 and 1000 and ${t.revision}>0 and length(trim(${t.name})) between 2 and 120 and (${t.effectiveTo} is null or ${t.effectiveTo}>=${t.effectiveFrom})`),index("hour_rule_scope_idx").on(t.organizationId,t.committeeId,t.effectiveFrom)]).enableRLS();
export const hourRecords=lub.table("hour_records",{
 id:uuid("id").primaryKey().defaultRandom(),organizationId:uuid("organization_id").notNull(),organizationMembershipId:uuid("organization_membership_id").notNull(),committeeId:uuid("committee_id"),academicTermId:uuid("academic_term_id").notNull().references(()=>academicTerms.id),sourceCode:varchar("source_code",{length:20}).notNull(),taskParticipantId:uuid("task_participant_id").references(()=>taskParticipants.id),eventAttendanceId:uuid("event_attendance_id").unique().references(()=>eventAttendance.id),hours:numeric("hours",{precision:6,scale:2}).notNull(),activityDate:date("activity_date").notNull(),description:text("description").notNull(),statusCode:varchar("status_code",{length:20}).notNull(),requestedByUserId:uuid("requested_by_user_id").notNull().references(()=>users.id),reviewedByUserId:uuid("reviewed_by_user_id").references(()=>users.id),reviewedAt:timestamp("reviewed_at",{withTimezone:true}),reviewNote:text("review_note"),createdAt:createdAt(),updatedAt:updatedAt(),
},t=>[foreignKey({columns:[t.organizationMembershipId,t.organizationId],foreignColumns:[organizationMemberships.id,organizationMemberships.organizationId]}),foreignKey({columns:[t.committeeId,t.organizationId],foreignColumns:[committees.id,committees.organizationId]}),unique("hour_task_participation_unique").on(t.taskParticipantId),check("hour_record_bounds_check",sql`${t.hours} between 0 and 1000 and length(trim(${t.description})) between 1 and 3000`),check("hour_record_source_check",sql`${t.sourceCode} in ('TASK','MANUAL','SELF_REPORTED','EVENT') and (${t.sourceCode}='EVENT')=(${t.eventAttendanceId} is not null) and (${t.sourceCode}='TASK')=(${t.taskParticipantId} is not null)`),check("hour_record_state_check",sql`${t.statusCode} in ('Pending','Approved','Rejected','Voided') and (${t.statusCode}='Pending')=(${t.reviewedAt} is null) and (${t.reviewedAt} is null)=(${t.reviewedByUserId} is null) and (${t.statusCode} not in ('Rejected','Voided') or length(trim(${t.reviewNote}))>0)`),index("hour_member_term_status_idx").on(t.organizationMembershipId,t.academicTermId,t.statusCode),index("hour_scope_time_idx").on(t.organizationId,t.committeeId,t.createdAt)]).enableRLS();
export const renewalCampaigns=lub.table("renewal_campaigns",{
 id:uuid("id").primaryKey().defaultRandom(),organizationId:uuid("organization_id").notNull().references(()=>organizations.id),academicTermId:uuid("academic_term_id").notNull().references(()=>academicTerms.id),opensAt:timestamp("opens_at",{withTimezone:true}).notNull(),closesAt:timestamp("closes_at",{withTimezone:true}).notNull(),excludeLeadership:boolean("exclude_leadership").notNull().default(false),statusCode:varchar("status_code",{length:20}).notNull().default("Draft"),createdAt:createdAt(),
},t=>[unique("renewal_org_term_unique").on(t.organizationId,t.academicTermId),check("renewal_bounds_check",sql`${t.closesAt}>${t.opensAt} and ${t.statusCode} in ('Draft','Open','Closed','Archived')`),index("renewal_org_time_idx").on(t.organizationId,t.createdAt)]).enableRLS();
export const renewalCampaignExclusions=lub.table("renewal_campaign_exclusions",{
 renewalCampaignId:uuid("renewal_campaign_id").notNull().references(()=>renewalCampaigns.id),organizationMembershipId:uuid("organization_membership_id").notNull().references(()=>organizationMemberships.id),reason:varchar("reason",{length:300}).notNull(),
},t=>[primaryKey({columns:[t.renewalCampaignId,t.organizationMembershipId]}),check("renewal_exclusion_reason_check",sql`length(trim(${t.reason})) between 1 and 300`)]).enableRLS();
export const membershipRenewals=lub.table("membership_renewals",{
 id:uuid("id").primaryKey().defaultRandom(),renewalCampaignId:uuid("renewal_campaign_id").notNull().references(()=>renewalCampaigns.id),organizationMembershipId:uuid("organization_membership_id").notNull().references(()=>organizationMemberships.id),responseCode:varchar("response_code",{length:20}).notNull().default("Pending"),respondedAt:timestamp("responded_at",{withTimezone:true}),
},t=>[unique("renewal_campaign_member_unique").on(t.renewalCampaignId,t.organizationMembershipId),check("renewal_response_check",sql`${t.responseCode} in ('Pending','Renewed','Declined','No_Response') and (${t.responseCode}='Pending')=(${t.respondedAt} is null)`),index("renewal_member_idx").on(t.organizationMembershipId)]).enableRLS();
export const hourDecisions=lub.table("hour_decisions",{
 id:uuid("id").primaryKey().defaultRandom(),hourRecordId:uuid("hour_record_id").notNull().references(()=>hourRecords.id),statusCode:varchar("status_code",{length:20}).notNull(),actorUserId:uuid("actor_user_id").notNull().references(()=>users.id),note:text("note").notNull(),createdAt:createdAt(),
},t=>[index("hour_decision_record_idx").on(t.hourRecordId),check("hour_decision_state_check",sql`${t.statusCode} in ('Approved','Rejected','Voided') and length(${t.note})<=3000`)]).enableRLS();

// Immutable UTF-8 source bytes allow retrying the same snapshot after Storage
// failures. Ready files are served from the private Supabase bucket.
export const events=lub.table("events",{
 id:uuid("id").primaryKey().defaultRandom(),organizationId:uuid("organization_id").notNull().references(()=>organizations.id),createdByUserId:uuid("created_by_user_id").notNull().references(()=>users.id),duplicatedFromEventId:uuid("duplicated_from_event_id"),registrationFormTemplateId:uuid("registration_form_template_id").references(()=>formTemplates.id),title:varchar("title",{length:120}).notNull(),description:text("description").notNull(),locationTypeCode:varchar("location_type_code",{length:20}).notNull(),locationText:varchar("location_text",{length:500}),onlineUrl:varchar("online_url",{length:2048}),startsAt:timestamp("starts_at",{withTimezone:true}).notNull(),endsAt:timestamp("ends_at",{withTimezone:true}).notNull(),registrationOpensAt:timestamp("registration_opens_at",{withTimezone:true}).notNull(),registrationClosesAt:timestamp("registration_closes_at",{withTimezone:true}).notNull(),capacity:integer("capacity"),attendanceHours:numeric("attendance_hours",{precision:6,scale:2}).notNull().default("0"),statusCode:varchar("status_code",{length:20}).notNull().default("Draft"),isFeatured:boolean("is_featured").notNull().default(false),publicReport:text("public_report").notNull().default(""),publicPhotos:text("public_photos").array().notNull().default(sql`'{}'::text[]`),revision:integer("revision").notNull().default(1),publishedAt:timestamp("published_at",{withTimezone:true}),completedAt:timestamp("completed_at",{withTimezone:true}),cancelledAt:timestamp("cancelled_at",{withTimezone:true}),createdAt:createdAt(),updatedAt:updatedAt(),
},t=>[unique("event_id_org_unique").on(t.id,t.organizationId),check("event_bounds_check",sql`length(trim(${t.title})) between 2 and 120 and length(${t.description})<=6000 and ${t.endsAt}>${t.startsAt} and ${t.registrationClosesAt}>${t.registrationOpensAt} and ${t.registrationClosesAt}<=${t.startsAt} and (${t.capacity} is null or ${t.capacity} between 1 and 10000) and ${t.attendanceHours} between 0 and 1000 and ${t.revision}>0`),check("event_state_check",sql`${t.statusCode} in ('Draft','Published','Completed','Cancelled') and (${t.statusCode}='Completed')=(${t.completedAt} is not null) and (${t.statusCode}='Cancelled')=(${t.cancelledAt} is not null)`),check("event_location_check",sql`${t.locationTypeCode} in ('In_Person','Online','Hybrid') and (${t.locationTypeCode}='Online' or coalesce(length(trim(${t.locationText})),0)>0) and (${t.locationTypeCode}='In_Person' or coalesce(${t.onlineUrl},'')~'^https://[^[:space:]]+$')`),check("event_public_content_check",sql`char_length(${t.publicReport})<=5000 and cardinality(${t.publicPhotos})<=4`),uniqueIndex("event_one_featured_idx").on(t.organizationId).where(sql`${t.isFeatured}`),index("event_public_time_idx").on(t.statusCode,t.startsAt,t.id),index("event_org_time_idx").on(t.organizationId,t.startsAt,t.id)]).enableRLS();
export const eventRegistrations=lub.table("event_registrations",{
 id:uuid("id").primaryKey().defaultRandom(),eventId:uuid("event_id").notNull().references(()=>events.id),userId:uuid("user_id").notNull().references(()=>users.id),formResponseId:uuid("form_response_id").unique().references(()=>formResponses.id),statusCode:varchar("status_code",{length:20}).notNull().default("Registered"),registeredAt:timestamp("registered_at",{withTimezone:true}).notNull().defaultNow(),cancelledAt:timestamp("cancelled_at",{withTimezone:true}),showOnProfile:boolean("show_on_profile").notNull().default(true),
},t=>[unique("event_registration_user_unique").on(t.eventId,t.userId),check("event_registration_state_check",sql`${t.statusCode} in ('Registered','Cancelled') and (${t.statusCode}='Cancelled')=(${t.cancelledAt} is not null)`),index("event_registration_user_idx").on(t.userId,t.registeredAt)]).enableRLS();
export const eventAttendance=lub.table("event_attendance",{
 id:uuid("id").primaryKey().defaultRandom(),eventRegistrationId:uuid("event_registration_id").notNull().unique().references(()=>eventRegistrations.id),statusCode:varchar("status_code",{length:20}).notNull(),checkedInAt:timestamp("checked_in_at",{withTimezone:true}),markedByUserId:uuid("marked_by_user_id").notNull().references(()=>users.id),
},t=>[check("event_attendance_state_check",sql`${t.statusCode} in ('Pending','Present','Absent','Excused') and (${t.statusCode}='Present')=(${t.checkedInAt} is not null)`)]).enableRLS();
export const eventContributions=lub.table("event_contributions",{
 id:uuid("id").primaryKey().defaultRandom(),eventId:uuid("event_id").notNull().references(()=>events.id),userId:uuid("user_id").notNull().references(()=>users.id),contributionTypeCode:varchar("contribution_type_code",{length:20}).notNull(),title:varchar("title",{length:120}).notNull(),verifiedByUserId:uuid("verified_by_user_id").notNull().references(()=>users.id),showOnProfile:boolean("show_on_profile").notNull().default(true),
},t=>[unique("event_contribution_user_type_unique").on(t.eventId,t.userId,t.contributionTypeCode),check("event_contribution_type_check",sql`${t.contributionTypeCode} in ('Presenter','Trainer','Core_Contributor') and length(trim(${t.title})) between 2 and 120`)]).enableRLS();
export const eventAssets=lub.table("event_assets",{
 eventId:uuid("event_id").notNull().references(()=>events.id),assetId:uuid("asset_id").notNull().references(()=>applicationAssets.id),assetTypeCode:varchar("asset_type_code",{length:20}).notNull(),
},t=>[primaryKey({columns:[t.eventId,t.assetId]}),check("event_asset_type_check",sql`${t.assetTypeCode} in ('Approval','Attendance','Report','Photo')`)]).enableRLS();
export const profileOrganizationSettings=lub.table("profile_organization_settings",{
 userId:uuid("user_id").notNull().references(()=>users.id),organizationId:uuid("organization_id").notNull().references(()=>organizations.id),showHours:boolean("show_hours").notNull().default(true),showMembershipHistory:boolean("show_membership_history").notNull().default(true),
},t=>[primaryKey({columns:[t.userId,t.organizationId]})]).enableRLS();
export const profileLinks=lub.table("profile_links",{
 id:uuid("id").primaryKey().defaultRandom(),userId:uuid("user_id").notNull().references(()=>users.id),linkType:varchar("link_type",{length:20}).notNull(),label:varchar("label",{length:80}).notNull(),urlOrValue:varchar("url_or_value",{length:2048}).notNull(),isPublic:boolean("is_public").notNull().default(false),
},t=>[check("talent_link_check",sql`${t.linkType} in ('Email','Phone','Website','LinkedIn','GitHub') and length(trim(${t.label})) between 1 and 80 and length(trim(${t.urlOrValue}))>0`),index("talent_link_user_idx").on(t.userId)]).enableRLS();
export const skills=lub.table("skills",{
 id:uuid("id").primaryKey().defaultRandom(),nameAr:varchar("name_ar",{length:80}).notNull().unique(),isActive:boolean("is_active").notNull().default(true),
},t=>[check("talent_skill_name_check",sql`length(trim(${t.nameAr})) between 2 and 80`)]).enableRLS();
export const studentSkills=lub.table("student_skills",{
 userId:uuid("user_id").notNull().references(()=>users.id),skillId:uuid("skill_id").notNull().references(()=>skills.id),sourceCode:varchar("source_code",{length:20}).notNull().default("Self_Declared"),isPublic:boolean("is_public").notNull().default(true),
},t=>[primaryKey({columns:[t.userId,t.skillId]}),check("talent_skill_source_check",sql`${t.sourceCode}='Self_Declared'`)]).enableRLS();
export const studentProjects=lub.table("student_projects",{
 id:uuid("id").primaryKey().defaultRandom(),userId:uuid("user_id").notNull().references(()=>users.id),taskParticipantId:uuid("task_participant_id").unique().references(()=>taskParticipants.id),eventContributionId:uuid("event_contribution_id").unique().references(()=>eventContributions.id),displayTitle:varchar("display_title",{length:120}).notNull(),displayDescription:varchar("display_description",{length:1000}).notNull().default(""),isPublic:boolean("is_public").notNull().default(false),isFeatured:boolean("is_featured").notNull().default(false),createdAt:createdAt(),updatedAt:updatedAt(),
},t=>[check("talent_project_source_check",sql`(${t.taskParticipantId} is null)<>(${t.eventContributionId} is null) and length(trim(${t.displayTitle})) between 2 and 120`),index("talent_project_user_idx").on(t.userId,t.isFeatured,t.createdAt)]).enableRLS();
export const assets=lub.table("assets",{
 id:uuid("id").primaryKey().defaultRandom(),uploadedByUserId:uuid("uploaded_by_user_id").notNull().references(()=>users.id),storageKey:varchar("storage_key",{length:100}).notNull().unique(),originalName:varchar("original_name",{length:100}).notNull(),mimeType:varchar("mime_type",{length:40}).notNull(),sizeBytes:integer("size_bytes").notNull(),checksumSha256:varchar("checksum_sha256",{length:64}).notNull(),visibilityCode:varchar("visibility_code",{length:20}).notNull().default("Private"),body:text("body").notNull(),createdAt:createdAt(),
},t=>[check("generated_asset_check",sql`${t.visibilityCode}='Private' and ${t.mimeType} in ('text/html','text/csv') and ${t.sizeBytes}=octet_length(${t.body}) and ${t.sizeBytes} between 1 and 2097152 and ${t.checksumSha256}=encode(sha256(convert_to(${t.body},'UTF8')),'hex')`)]).enableRLS();
export const generatedDocuments=lub.table("generated_documents",{
 id:uuid("id").primaryKey().defaultRandom(),organizationId:uuid("organization_id").notNull().references(()=>organizations.id),committeeId:uuid("committee_id").references(()=>committees.id),documentTypeCode:varchar("document_type_code",{length:40}).notNull(),subjectUserId:uuid("subject_user_id").references(()=>users.id),academicTermId:uuid("academic_term_id").references(()=>academicTerms.id),periodStart:date("period_start"),periodEnd:date("period_end"),assetId:uuid("asset_id").notNull().unique().references(()=>assets.id),dataSnapshotJson:jsonb("data_snapshot_json").notNull(),templateSnapshotJson:jsonb("template_snapshot_json").notNull(),generatedByUserId:uuid("generated_by_user_id").notNull().references(()=>users.id),generatedAt:timestamp("generated_at",{withTimezone:true}).notNull().defaultNow(),statusCode:varchar("status_code",{length:20}).notNull().default("Generating"),archivedAt:timestamp("archived_at",{withTimezone:true}),uploadAttempt:uuid("upload_attempt").notNull().defaultRandom(),uploadStartedAt:timestamp("upload_started_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[check("document_kind_check",sql`${t.documentTypeCode} in ('Hours_Report','Hours_Certificate') and (${t.documentTypeCode}='Hours_Certificate')=(${t.subjectUserId} is not null)`),check("document_state_check",sql`${t.statusCode} in ('Generating','Ready','Failed','Archived') and (${t.statusCode}='Archived')=(${t.archivedAt} is not null) and (${t.periodStart} is null)=(${t.periodEnd} is null) and (${t.periodStart} is null or ${t.periodEnd}>=${t.periodStart})`),index("document_org_time_idx").on(t.organizationId,t.generatedAt,t.id),index("document_subject_time_idx").on(t.subjectUserId,t.generatedAt,t.id)]).enableRLS();

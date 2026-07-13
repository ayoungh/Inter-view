import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  candidateTokenHash: text("candidate_token_hash").notNull(),
  candidateTokenCiphertext: text("candidate_token_ciphertext"),
  reportTokenHash: text("report_token_hash").notNull(),
  reportTokenCiphertext: text("report_token_ciphertext").notNull(),
  challengeId: text("challenge_id").notNull(),
  challengeVersion: integer("challenge_version").notNull(),
  language: text("language").notNull(),
  candidateName: text("candidate_name").notNull(),
  status: text("status").notNull(),
  revision: integer("revision").notNull().default(0),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sessions_candidate_token_hash_idx").on(table.candidateTokenHash),
  index("sessions_created_at_idx").on(table.createdAt),
]);

export const sessionFiles = pgTable("session_files", {
  id: uuid("id").primaryKey(), sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }), path: text("path").notNull(),
  status: text("status").notNull(), baseContent: text("base_content").notNull(), headContent: text("head_content").notNull(), savedContent: text("saved_content"),
}, (table) => [index("session_files_session_idx").on(table.sessionId)]);

export const reviewComments = pgTable("review_comments", {
  id: uuid("id").primaryKey(), sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }), file: text("file").notNull(), line: integer("line").notNull(), endLine: integer("end_line"), body: text("body").notNull(), state: text("state").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [index("review_comments_session_idx").on(table.sessionId)]);

export const fileRevisions = pgTable("file_revisions", {
  id: uuid("id").primaryKey(), sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }), revision: integer("revision").notNull(), files: jsonb("files").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [index("file_revisions_session_revision_idx").on(table.sessionId, table.revision)]);

export const checkRuns = pgTable("check_runs", {
  id: uuid("id").primaryKey(), sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }), revision: integer("revision").notNull(), status: text("status").notNull(), results: jsonb("results").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull(), completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [index("check_runs_session_idx").on(table.sessionId)]);

export const aiAssessments = pgTable("ai_assessments", {
  id: uuid("id").primaryKey(), sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }), basedOnEventId: bigint("based_on_event_id", { mode: "number" }).notNull(), revision: integer("revision").notNull(), assessment: jsonb("assessment").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [index("ai_assessments_session_revision_idx").on(table.sessionId, table.revision)]);

export const interviewerNotes = pgTable("interviewer_notes", {
  sessionId: uuid("session_id").primaryKey().references(() => sessions.id, { onDelete: "cascade" }), body: text("body").notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sessionEvents = pgTable("session_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(), sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }), type: text("type").notNull(), actor: text("actor").notNull(), payload: jsonb("payload").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("session_events_cursor_idx").on(table.sessionId, table.id)]);

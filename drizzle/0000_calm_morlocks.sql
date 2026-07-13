CREATE TABLE "ai_assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"based_on_event_id" bigint NOT NULL,
	"revision" integer NOT NULL,
	"assessment" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" text NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"files" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviewer_notes" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"file" text NOT NULL,
	"line" integer NOT NULL,
	"end_line" integer,
	"body" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"path" text NOT NULL,
	"status" text NOT NULL,
	"base_content" text NOT NULL,
	"head_content" text NOT NULL,
	"saved_content" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"candidate_token_hash" text NOT NULL,
	"report_token_hash" text NOT NULL,
	"report_token_ciphertext" text NOT NULL,
	"challenge_id" text NOT NULL,
	"challenge_version" integer NOT NULL,
	"language" text NOT NULL,
	"candidate_name" text NOT NULL,
	"status" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_runs" ADD CONSTRAINT "check_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_revisions" ADD CONSTRAINT "file_revisions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviewer_notes" ADD CONSTRAINT "interviewer_notes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_files" ADD CONSTRAINT "session_files_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_assessments_session_revision_idx" ON "ai_assessments" USING btree ("session_id","revision");--> statement-breakpoint
CREATE INDEX "check_runs_session_idx" ON "check_runs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "file_revisions_session_revision_idx" ON "file_revisions" USING btree ("session_id","revision");--> statement-breakpoint
CREATE INDEX "review_comments_session_idx" ON "review_comments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_events_cursor_idx" ON "session_events" USING btree ("session_id","id");--> statement-breakpoint
CREATE INDEX "session_files_session_idx" ON "session_files" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_candidate_token_hash_idx" ON "sessions" USING btree ("candidate_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
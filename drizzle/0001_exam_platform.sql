CREATE TYPE "public"."multi_scoring" AS ENUM('ALL_OR_NOTHING', 'PARTIAL');--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'RECONNECTED';--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'SYNC_FAILED';--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'DUPLICATE_SUBMISSION';--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'ATTEMPT_RESUMED';--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'LATE_ANSWER_REJECTED';--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'AUTO_SUBMITTED';--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(32),
	"entity_id" uuid,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scratchpads" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferences" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "enrollment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "is_sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "client_session_id" varchar(64);--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "shuffle_options" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "topic" varchar(80);--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "multi_scoring" "multi_scoring" DEFAULT 'ALL_OR_NOTHING' NOT NULL;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "verification_code" varchar(24);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scratchpads" ADD CONSTRAINT "scratchpads_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_open_uq" ON "attempts" USING btree ("exam_id","candidate_id") WHERE "attempts"."status" = 'IN_PROGRESS';--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_verification_code_unique" UNIQUE("verification_code");
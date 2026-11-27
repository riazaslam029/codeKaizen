ALTER TYPE "public"."incident_type" ADD VALUE 'ACCESS_RESTRICTED';--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'ACCESS_RESTORED';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;
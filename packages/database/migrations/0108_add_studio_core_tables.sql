CREATE TABLE IF NOT EXISTS "studio_projects" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "current_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "studio_projects_user_id_idx" ON "studio_projects" ("user_id");
CREATE INDEX IF NOT EXISTS "studio_projects_updated_at_idx" ON "studio_projects" ("updated_at");

CREATE TABLE IF NOT EXISTS "studio_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "studio_messages" ADD CONSTRAINT "studio_messages_project_id_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."studio_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "studio_messages" ADD CONSTRAINT "studio_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "studio_messages_project_id_idx" ON "studio_messages" ("project_id");
CREATE INDEX IF NOT EXISTS "studio_messages_created_at_idx" ON "studio_messages" ("created_at");
CREATE INDEX IF NOT EXISTS "studio_messages_user_id_idx" ON "studio_messages" ("user_id");

CREATE TABLE IF NOT EXISTS "studio_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "file_tree" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "diff" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "studio_snapshots" ADD CONSTRAINT "studio_snapshots_project_id_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."studio_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "studio_snapshots" ADD CONSTRAINT "studio_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "studio_snapshots_project_version_idx" ON "studio_snapshots" ("project_id", "version");
CREATE INDEX IF NOT EXISTS "studio_snapshots_project_id_idx" ON "studio_snapshots" ("project_id");
CREATE INDEX IF NOT EXISTS "studio_snapshots_user_id_idx" ON "studio_snapshots" ("user_id");

CREATE TABLE IF NOT EXISTS "studio_deployments" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "deployment_type" text NOT NULL,
  "provider" text DEFAULT 'vercel' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "url" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "studio_deployments" ADD CONSTRAINT "studio_deployments_project_id_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."studio_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "studio_deployments" ADD CONSTRAINT "studio_deployments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "studio_deployments_project_id_idx" ON "studio_deployments" ("project_id");
CREATE INDEX IF NOT EXISTS "studio_deployments_user_id_idx" ON "studio_deployments" ("user_id");
CREATE INDEX IF NOT EXISTS "studio_deployments_created_at_idx" ON "studio_deployments" ("created_at");

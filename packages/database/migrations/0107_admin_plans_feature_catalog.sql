CREATE TABLE IF NOT EXISTS "admin_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "monthly_credits" jsonb DEFAULT '{}'::jsonb,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_plans_key_unique" ON "admin_plans" ("key");

CREATE TABLE IF NOT EXISTS "admin_plan_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_key" text NOT NULL,
  "flag_key" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "limits" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_plan_features_plan_key_idx" ON "admin_plan_features" ("plan_key");
CREATE INDEX IF NOT EXISTS "admin_plan_features_flag_key_idx" ON "admin_plan_features" ("flag_key");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_plan_features_plan_flag_unique" ON "admin_plan_features" ("plan_key", "flag_key");

CREATE TABLE IF NOT EXISTS "admin_user_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "plan_key" text NOT NULL,
  "assigned_by" text,
  "notes" text,
  "starts_at" timestamptz DEFAULT now() NOT NULL,
  "ends_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "admin_user_plans" ADD CONSTRAINT "admin_user_plans_user_id_users_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "admin_user_plans" ADD CONSTRAINT "admin_user_plans_assigned_by_users_id_fk"
 FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "admin_user_plans_user_id_idx" ON "admin_user_plans" ("user_id");
CREATE INDEX IF NOT EXISTS "admin_user_plans_plan_key_idx" ON "admin_user_plans" ("plan_key");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_plans_user_unique" ON "admin_user_plans" ("user_id");

ALTER TABLE public.admin_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_only_admin_plans" ON public.admin_plans;
CREATE POLICY "admin_only_admin_plans" ON public.admin_plans
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_only_admin_plan_features" ON public.admin_plan_features;
CREATE POLICY "admin_only_admin_plan_features" ON public.admin_plan_features
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_only_admin_user_plans" ON public.admin_user_plans;
CREATE POLICY "admin_only_admin_user_plans" ON public.admin_user_plans
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

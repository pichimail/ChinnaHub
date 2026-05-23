CREATE TABLE IF NOT EXISTS "feature_flag_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enabled" boolean NOT NULL,
  "flag_key" text NOT NULL,
  "source" text DEFAULT 'admin' NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "feature_flag_assignments" ADD CONSTRAINT "feature_flag_assignments_user_id_users_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "feature_flag_assignments_flag_key_idx" ON "feature_flag_assignments" ("flag_key");
CREATE INDEX IF NOT EXISTS "feature_flag_assignments_user_id_idx" ON "feature_flag_assignments" ("user_id");

CREATE TABLE IF NOT EXISTS "admin_env_vars" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "domain" text DEFAULT 'global' NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_secret" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_env_vars_domain_key_idx" ON "admin_env_vars" ("domain", "key");

CREATE TABLE IF NOT EXISTS "admin_governance_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb,
  "domain" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "mode" text DEFAULT 'allow' NOT NULL,
  "notes" text,
  "priority" integer DEFAULT 100 NOT NULL,
  "target" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "admin_governance_policies_domain_idx" ON "admin_governance_policies" ("domain");
CREATE INDEX IF NOT EXISTS "admin_governance_policies_target_idx" ON "admin_governance_policies" ("target");

CREATE OR REPLACE FUNCTION public.is_admin_user() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = current_setting('request.jwt.claim.sub', true)
      AND (u.role = 'admin' OR u.email = 'pichimail24@gmail.com')
  );
$$;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_governance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_only_feature_flags" ON public.feature_flags;
CREATE POLICY "admin_only_feature_flags" ON public.feature_flags
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_only_admin_api_keys" ON public.admin_api_keys;
CREATE POLICY "admin_only_admin_api_keys" ON public.admin_api_keys
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_only_admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "admin_only_admin_audit_logs" ON public.admin_audit_logs
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_only_feature_flag_assignments" ON public.feature_flag_assignments;
CREATE POLICY "admin_only_feature_flag_assignments" ON public.feature_flag_assignments
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_only_admin_env_vars" ON public.admin_env_vars;
CREATE POLICY "admin_only_admin_env_vars" ON public.admin_env_vars
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_only_admin_governance_policies" ON public.admin_governance_policies;
CREATE POLICY "admin_only_admin_governance_policies" ON public.admin_governance_policies
FOR ALL
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

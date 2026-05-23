CREATE TABLE IF NOT EXISTS "admin_feature_flags" (
  "key" varchar(128) PRIMARY KEY NOT NULL,
  "name" varchar(128) NOT NULL,
  "description" text,
  "enabled_by_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_feature_flags_name_idx" ON "admin_feature_flags" ("name");

CREATE TABLE IF NOT EXISTS "admin_user_feature_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "flag_key" varchar(128) NOT NULL,
  "enabled" boolean NOT NULL,
  "updated_by" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_user_feature_flags_user_id_idx" ON "admin_user_feature_flags" ("user_id");
CREATE INDEX IF NOT EXISTS "admin_user_feature_flags_flag_key_idx" ON "admin_user_feature_flags" ("flag_key");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_feature_flags_user_flag_unique_idx" ON "admin_user_feature_flags" ("user_id", "flag_key");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_user_feature_flags_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "admin_user_feature_flags"
      ADD CONSTRAINT "admin_user_feature_flags_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_user_feature_flags_flag_key_admin_feature_flags_key_fk'
  ) THEN
    ALTER TABLE "admin_user_feature_flags"
      ADD CONSTRAINT "admin_user_feature_flags_flag_key_admin_feature_flags_key_fk"
      FOREIGN KEY ("flag_key") REFERENCES "public"."admin_feature_flags"("key") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_user_feature_flags_updated_by_users_id_fk'
  ) THEN
    ALTER TABLE "admin_user_feature_flags"
      ADD CONSTRAINT "admin_user_feature_flags_updated_by_users_id_fk"
      FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "admin_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(128) NOT NULL,
  "key_hash" varchar(128) NOT NULL,
  "key_prefix" varchar(32) NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" text NOT NULL,
  "last_used_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_api_keys_name_idx" ON "admin_api_keys" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_api_keys_hash_unique_idx" ON "admin_api_keys" ("key_hash");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_api_keys_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "admin_api_keys"
      ADD CONSTRAINT "admin_api_keys_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "admin_content_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_type" varchar(64) NOT NULL,
  "content_id" text NOT NULL,
  "action" varchar(64) NOT NULL,
  "reason" text,
  "metadata" jsonb,
  "created_by" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_content_audit_logs_content_idx" ON "admin_content_audit_logs" ("content_type", "content_id");
CREATE INDEX IF NOT EXISTS "admin_content_audit_logs_created_at_idx" ON "admin_content_audit_logs" ("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_content_audit_logs_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "admin_content_audit_logs"
      ADD CONSTRAINT "admin_content_audit_logs_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

ALTER TABLE "admin_feature_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_user_feature_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_content_audit_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_feature_flags_read_policy ON "admin_feature_flags";
CREATE POLICY admin_feature_flags_read_policy
ON "admin_feature_flags"
FOR SELECT
USING (current_setting('app.current_is_admin', true) = 'true');

DROP POLICY IF EXISTS admin_feature_flags_write_policy ON "admin_feature_flags";
CREATE POLICY admin_feature_flags_write_policy
ON "admin_feature_flags"
FOR ALL
USING (current_setting('app.current_is_admin', true) = 'true')
WITH CHECK (current_setting('app.current_is_admin', true) = 'true');

DROP POLICY IF EXISTS admin_user_feature_flags_read_policy ON "admin_user_feature_flags";
CREATE POLICY admin_user_feature_flags_read_policy
ON "admin_user_feature_flags"
FOR SELECT
USING (
  current_setting('app.current_is_admin', true) = 'true'
  OR user_id = nullif(current_setting('app.current_user_id', true), '')
);

DROP POLICY IF EXISTS admin_user_feature_flags_write_policy ON "admin_user_feature_flags";
CREATE POLICY admin_user_feature_flags_write_policy
ON "admin_user_feature_flags"
FOR ALL
USING (current_setting('app.current_is_admin', true) = 'true')
WITH CHECK (current_setting('app.current_is_admin', true) = 'true');

DROP POLICY IF EXISTS admin_api_keys_policy ON "admin_api_keys";
CREATE POLICY admin_api_keys_policy
ON "admin_api_keys"
FOR ALL
USING (current_setting('app.current_is_admin', true) = 'true')
WITH CHECK (current_setting('app.current_is_admin', true) = 'true');

DROP POLICY IF EXISTS admin_content_audit_logs_policy ON "admin_content_audit_logs";
CREATE POLICY admin_content_audit_logs_policy
ON "admin_content_audit_logs"
FOR ALL
USING (current_setting('app.current_is_admin', true) = 'true')
WITH CHECK (current_setting('app.current_is_admin', true) = 'true');

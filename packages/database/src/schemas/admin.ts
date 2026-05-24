import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './user';

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    defaultEnabled: boolean('default_enabled').notNull().default(false),
    enabledUserIds: jsonb('enabled_user_ids').$type<string[]>().default([]),
    disabledUserIds: jsonb('disabled_user_ids').$type<string[]>().default([]),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('feature_flags_key_idx').on(t.key)],
);

export const featureFlagAssignments = pgTable(
  'feature_flag_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    enabled: boolean('enabled').notNull(),
    flagKey: text('flag_key').notNull(),
    source: text('source').notNull().default('admin'),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('feature_flag_assignments_flag_key_idx').on(t.flagKey),
    index('feature_flag_assignments_user_id_idx').on(t.userId),
  ],
);

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminId: text('admin_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    adminEmail: text('admin_email'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_admin_id_idx').on(t.adminId),
    index('audit_logs_action_idx').on(t.action),
    index('audit_logs_created_at_idx').on(t.createdAt),
    index('audit_logs_target_id_idx').on(t.targetId),
  ],
);

export const adminApiKeys = pgTable(
  'admin_api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    service: text('service').notNull().unique(),
    keyValue: text('key_value').notNull(),
    label: text('label').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    config: jsonb('config').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('admin_api_keys_service_idx').on(t.service)],
);

export const adminEnvVars = pgTable(
  'admin_env_vars',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    domain: text('domain').notNull().default('global'),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    isSecret: boolean('is_secret').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('admin_env_vars_domain_key_idx').on(t.domain, t.key)],
);

export const adminGovernancePolicies = pgTable(
  'admin_governance_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    domain: text('domain').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    mode: text('mode').notNull().default('allow'),
    notes: text('notes'),
    priority: integer('priority').notNull().default(100),
    target: text('target').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('admin_governance_policies_domain_idx').on(t.domain),
    index('admin_governance_policies_target_idx').on(t.target),
  ],
);

export const adminPlans = pgTable(
  'admin_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    monthlyCredits: jsonb('monthly_credits')
      .$type<{
        audio?: number;
        chat?: number;
        image?: number;
        video?: number;
      }>()
      .default({}),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(100),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('admin_plans_key_unique').on(t.key)],
);

export const adminPlanFeatures = pgTable(
  'admin_plan_features',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planKey: text('plan_key').notNull(),
    flagKey: text('flag_key').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    limits: jsonb('limits').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('admin_plan_features_plan_key_idx').on(t.planKey),
    index('admin_plan_features_flag_key_idx').on(t.flagKey),
    uniqueIndex('admin_plan_features_plan_flag_unique').on(t.planKey, t.flagKey),
  ],
);

export const adminUserPlans = pgTable(
  'admin_user_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    planKey: text('plan_key').notNull(),
    assignedBy: text('assigned_by').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('admin_user_plans_user_id_idx').on(t.userId),
    index('admin_user_plans_plan_key_idx').on(t.planKey),
    uniqueIndex('admin_user_plans_user_unique').on(t.userId),
  ],
);

export type NewFeatureFlag = typeof featureFlags.$inferInsert;
export type FeatureFlagItem = typeof featureFlags.$inferSelect;
export type NewFeatureFlagAssignment = typeof featureFlagAssignments.$inferInsert;
export type FeatureFlagAssignmentItem = typeof featureFlagAssignments.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
export type AdminAuditLogItem = typeof adminAuditLogs.$inferSelect;
export type NewAdminApiKey = typeof adminApiKeys.$inferInsert;
export type AdminApiKeyItem = typeof adminApiKeys.$inferSelect;
export type NewAdminEnvVar = typeof adminEnvVars.$inferInsert;
export type AdminEnvVarItem = typeof adminEnvVars.$inferSelect;
export type NewAdminGovernancePolicy = typeof adminGovernancePolicies.$inferInsert;
export type AdminGovernancePolicyItem = typeof adminGovernancePolicies.$inferSelect;
export type NewAdminPlan = typeof adminPlans.$inferInsert;
export type AdminPlanItem = typeof adminPlans.$inferSelect;
export type NewAdminPlanFeature = typeof adminPlanFeatures.$inferInsert;
export type AdminPlanFeatureItem = typeof adminPlanFeatures.$inferSelect;
export type NewAdminUserPlan = typeof adminUserPlans.$inferInsert;
export type AdminUserPlanItem = typeof adminUserPlans.$inferSelect;

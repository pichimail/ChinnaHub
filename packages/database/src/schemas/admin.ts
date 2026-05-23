import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { timestamps } from './_helpers';
import { users } from './user';

export const adminFeatureFlags = pgTable(
  'admin_feature_flags',
  {
    key: varchar('key', { length: 128 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    enabledByDefault: boolean('enabled_by_default').notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex('admin_feature_flags_name_idx').on(table.name)],
);

export const adminUserFeatureFlags = pgTable(
  'admin_user_feature_flags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    flagKey: varchar('flag_key', { length: 128 })
      .notNull()
      .references(() => adminFeatureFlags.key, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admin_user_feature_flags_user_id_idx').on(table.userId),
    index('admin_user_feature_flags_flag_key_idx').on(table.flagKey),
    uniqueIndex('admin_user_feature_flags_user_flag_unique_idx').on(table.userId, table.flagKey),
  ],
);

export const adminApiKeys = pgTable(
  'admin_api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    keyHash: varchar('key_hash', { length: 128 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
    scopes: jsonb('scopes')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('admin_api_keys_name_idx').on(table.name),
    uniqueIndex('admin_api_keys_hash_unique_idx').on(table.keyHash),
  ],
);

export const adminContentAuditLogs = pgTable(
  'admin_content_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    contentType: varchar('content_type', { length: 64 }).notNull(),
    contentId: text('content_id').notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admin_content_audit_logs_content_idx').on(table.contentType, table.contentId),
    index('admin_content_audit_logs_created_at_idx').on(table.createdAt),
  ],
);

import { index, integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { createdAt, timestamps } from './_helpers';
import { users } from './user';

export const studioProjects = pgTable(
  'studio_projects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('studioProjects'))
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    currentState: jsonb('current_state').default({}).notNull(),
    settings: jsonb('settings').default({}).notNull(),
    ...timestamps,
  },
  (t) => [
    index('studio_projects_user_id_idx').on(t.userId),
    index('studio_projects_updated_at_idx').on(t.updatedAt),
  ],
);

export const studioMessages = pgTable(
  'studio_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('studioMessages'))
      .notNull(),
    projectId: text('project_id')
      .references(() => studioProjects.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('studio_messages_project_id_idx').on(t.projectId),
    index('studio_messages_created_at_idx').on(t.createdAt),
    index('studio_messages_user_id_idx').on(t.userId),
  ],
);

export const studioSnapshots = pgTable(
  'studio_snapshots',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('studioSnapshots'))
      .notNull(),
    projectId: text('project_id')
      .references(() => studioProjects.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    fileTree: jsonb('file_tree').default({}).notNull(),
    diff: jsonb('diff'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('studio_snapshots_project_version_idx').on(t.projectId, t.version),
    index('studio_snapshots_project_id_idx').on(t.projectId),
    index('studio_snapshots_user_id_idx').on(t.userId),
  ],
);

export const studioDeployments = pgTable(
  'studio_deployments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => idGenerator('studioDeployments'))
      .notNull(),
    projectId: text('project_id')
      .references(() => studioProjects.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    deploymentType: text('deployment_type').notNull(),
    provider: text('provider').default('vercel').notNull(),
    status: text('status').default('pending').notNull(),
    url: text('url').notNull(),
    metadata: jsonb('metadata').default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('studio_deployments_project_id_idx').on(t.projectId),
    index('studio_deployments_user_id_idx').on(t.userId),
    index('studio_deployments_created_at_idx').on(t.createdAt),
  ],
);

export type StudioProjectItem = typeof studioProjects.$inferSelect;
export type NewStudioProject = typeof studioProjects.$inferInsert;

export type StudioMessageItem = typeof studioMessages.$inferSelect;
export type NewStudioMessage = typeof studioMessages.$inferInsert;

export type StudioSnapshotItem = typeof studioSnapshots.$inferSelect;
export type NewStudioSnapshot = typeof studioSnapshots.$inferInsert;

export type StudioDeploymentItem = typeof studioDeployments.$inferSelect;
export type NewStudioDeployment = typeof studioDeployments.$inferInsert;

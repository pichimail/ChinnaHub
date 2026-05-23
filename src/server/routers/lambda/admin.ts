import { createHash, randomBytes } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { z } from 'zod';

import {
  adminApiKeys,
  adminContentAuditLogs,
  adminFeatureFlags,
  adminUserFeatureFlags,
  messages,
  topics,
  users,
} from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const ADMIN_EMAIL = 'pichimail24@gmail.com';

const adminProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  const user = await ctx.serverDB.query.users.findFirst({
    columns: { email: true, normalizedEmail: true },
    where: eq(users.id, ctx.userId),
  });

  const email = (user?.normalizedEmail || user?.email || '').toLowerCase();
  if (email !== ADMIN_EMAIL) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }

  return next();
});

const writeAuditLog = async (
  serverDB: any,
  createdBy: string,
  payload: {
    action: string;
    contentId: string;
    contentType: string;
    metadata?: Record<string, any>;
    reason?: string;
  },
) => {
  await serverDB.insert(adminContentAuditLogs).values({
    action: payload.action,
    contentId: payload.contentId,
    contentType: payload.contentType,
    createdBy,
    metadata: payload.metadata || {},
    reason: payload.reason,
  });
};

export const adminRouter = router({
  banUser: adminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).optional(),
        reason: z.string().max(2000).optional(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot ban current admin account' });
      }

      const banExpires = input.days
        ? new Date(Date.now() + input.days * 24 * 60 * 60 * 1000)
        : null;

      await ctx.serverDB
        .update(users)
        .set({
          banExpires,
          banReason: input.reason || null,
          banned: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId));

      await writeAuditLog(ctx.serverDB, ctx.userId, {
        action: 'user_ban',
        contentId: input.userId,
        contentType: 'user',
        metadata: { banExpires, days: input.days },
        reason: input.reason,
      });

      return { success: true };
    }),

  createApiKey: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(128),
        scopes: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const raw = `adm_${randomBytes(24).toString('hex')}`;
      const hash = createHash('sha256').update(raw).digest('hex');
      const prefix = raw.slice(0, 12);

      const [created] = await ctx.serverDB
        .insert(adminApiKeys)
        .values({
          createdBy: ctx.userId,
          keyHash: hash,
          keyPrefix: prefix,
          name: input.name,
          scopes: input.scopes,
        })
        .returning();

      await writeAuditLog(ctx.serverDB, ctx.userId, {
        action: 'api_key_create',
        contentId: created.id,
        contentType: 'api_key',
        metadata: { keyPrefix: created.keyPrefix, name: created.name },
      });

      return { ...created, rawKey: raw };
    }),

  listApiKeys: adminProcedure.query(async ({ ctx }) => {
    return ctx.serverDB.query.adminApiKeys.findMany({
      orderBy: [desc(adminApiKeys.createdAt)],
    });
  }),

  listContent: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const recentMessages = await ctx.serverDB.query.messages.findMany({
        columns: { content: true, createdAt: true, id: true, role: true, userId: true },
        limit: input.limit,
        orderBy: [desc(messages.createdAt)],
      });

      const recentTopics = await ctx.serverDB.query.topics.findMany({
        columns: { createdAt: true, id: true, title: true, userId: true },
        limit: input.limit,
        orderBy: [desc(topics.createdAt)],
      });

      return { recentMessages, recentTopics };
    }),

  listAuditLogs: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        contentType: z.string().optional(),
        createdBy: z.string().optional(),
        endAt: z.string().datetime().optional(),
        limit: z.number().min(1).max(5000).default(200),
        startAt: z.string().datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.action) conditions.push(eq(adminContentAuditLogs.action, input.action));
      if (input.contentType)
        conditions.push(eq(adminContentAuditLogs.contentType, input.contentType));
      if (input.createdBy) conditions.push(eq(adminContentAuditLogs.createdBy, input.createdBy));
      if (input.startAt)
        conditions.push(gte(adminContentAuditLogs.createdAt, new Date(input.startAt)));
      if (input.endAt) conditions.push(lte(adminContentAuditLogs.createdAt, new Date(input.endAt)));

      return ctx.serverDB.query.adminContentAuditLogs.findMany({
        limit: input.limit,
        orderBy: [desc(adminContentAuditLogs.createdAt)],
        where: conditions.length > 0 ? and(...conditions) : undefined,
      });
    }),

  listFeatureFlags: adminProcedure.query(async ({ ctx }) => {
    return ctx.serverDB.query.adminFeatureFlags.findMany({
      orderBy: [desc(adminFeatureFlags.updatedAt)],
    });
  }),

  listUsers: adminProcedure
    .input(
      z.object({
        keyword: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.keyword
        ? or(
            ilike(users.email, `%${input.keyword}%`),
            ilike(users.username, `%${input.keyword}%`),
            ilike(users.fullName, `%${input.keyword}%`),
          )
        : undefined;

      return ctx.serverDB.query.users.findMany({
        columns: {
          banned: true,
          createdAt: true,
          email: true,
          fullName: true,
          id: true,
          role: true,
          username: true,
        },
        limit: input.limit,
        orderBy: [desc(users.createdAt)],
        where,
      });
    }),

  revokeApiKey: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(adminApiKeys)
        .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(adminApiKeys.id, input.id));

      await writeAuditLog(ctx.serverDB, ctx.userId, {
        action: 'api_key_revoke',
        contentId: input.id,
        contentType: 'api_key',
      });

      return { success: true };
    }),

  setFlagForUser: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        flagKey: z.string().min(1).max(128),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB.query.adminUserFeatureFlags.findFirst({
        where: and(
          eq(adminUserFeatureFlags.flagKey, input.flagKey),
          eq(adminUserFeatureFlags.userId, input.userId),
        ),
      });

      if (existing) {
        await ctx.serverDB
          .update(adminUserFeatureFlags)
          .set({
            enabled: input.enabled,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          })
          .where(eq(adminUserFeatureFlags.id, existing.id));
      } else {
        await ctx.serverDB.insert(adminUserFeatureFlags).values({
          enabled: input.enabled,
          flagKey: input.flagKey,
          updatedBy: ctx.userId,
          userId: input.userId,
        });
      }

      await writeAuditLog(ctx.serverDB, ctx.userId, {
        action: 'user_flag_set',
        contentId: input.userId,
        contentType: 'user',
        metadata: { enabled: input.enabled, flagKey: input.flagKey },
      });

      return { success: true };
    }),

  stats: adminProcedure.query(async ({ ctx }) => {
    const [usersCount] = await ctx.serverDB.select({ value: count() }).from(users);
    const [messagesCount] = await ctx.serverDB.select({ value: count() }).from(messages);
    const [topicsCount] = await ctx.serverDB.select({ value: count() }).from(topics);

    const [activeApiKeys] = await ctx.serverDB
      .select({ value: count() })
      .from(adminApiKeys)
      .where(eq(adminApiKeys.isActive, true));

    const [flagsCount] = await ctx.serverDB.select({ value: count() }).from(adminFeatureFlags);

    return {
      activeApiKeys: Number(activeApiKeys?.value || 0),
      featureFlags: Number(flagsCount?.value || 0),
      messages: Number(messagesCount?.value || 0),
      topics: Number(topicsCount?.value || 0),
      users: Number(usersCount?.value || 0),
    };
  }),

  upsertFeatureFlag: adminProcedure
    .input(
      z.object({
        description: z.string().optional(),
        enabledByDefault: z.boolean().default(false),
        key: z.string().min(1).max(128),
        name: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB.query.adminFeatureFlags.findFirst({
        where: eq(adminFeatureFlags.key, input.key),
      });

      if (existing) {
        const [updated] = await ctx.serverDB
          .update(adminFeatureFlags)
          .set({
            description: input.description,
            enabledByDefault: input.enabledByDefault,
            name: input.name,
            updatedAt: new Date(),
          })
          .where(eq(adminFeatureFlags.key, input.key))
          .returning();

        await writeAuditLog(ctx.serverDB, ctx.userId, {
          action: 'feature_flag_update',
          contentId: updated.key,
          contentType: 'feature_flag',
          metadata: { enabledByDefault: updated.enabledByDefault, name: updated.name },
        });
        return updated;
      }

      const [created] = await ctx.serverDB.insert(adminFeatureFlags).values(input).returning();

      await writeAuditLog(ctx.serverDB, ctx.userId, {
        action: 'feature_flag_create',
        contentId: created.key,
        contentType: 'feature_flag',
        metadata: { enabledByDefault: created.enabledByDefault, name: created.name },
      });
      return created;
    }),

  unbanUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({
          banExpires: null,
          banReason: null,
          banned: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId));

      await writeAuditLog(ctx.serverDB, ctx.userId, {
        action: 'user_unban',
        contentId: input.userId,
        contentType: 'user',
      });

      return { success: true };
    }),

  updateUserRole: adminProcedure
    .input(
      z.object({
        role: z.string().max(64).nullable(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, input.userId));

      await writeAuditLog(ctx.serverDB, ctx.userId, {
        action: 'user_role_update',
        contentId: input.userId,
        contentType: 'user',
        metadata: { role: input.role },
      });

      return { success: true };
    }),
});

export type AdminRouter = typeof adminRouter;

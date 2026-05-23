import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  adminApiKeys,
  adminAuditLogs,
  adminEnvVars,
  adminGovernancePolicies,
  featureFlagAssignments,
  featureFlags,
} from '@/database/schemas/admin';
import { aiProviders } from '@/database/schemas/aiInfra';
import { users } from '@/database/schemas/user';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis } from '@/libs/redis';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const adminProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  const user = await ctx.serverDB.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
  const currentUser = user[0];

  if (!currentUser) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' });

  const isAdmin = currentUser.role === 'admin' || currentUser.email === 'pichimail24@gmail.com';
  if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });

  return opts.next({
    ctx: {
      ...ctx,
      adminEmail: currentUser.email,
      adminId: ctx.userId,
    },
  });
});

const publishRuntimeFeatureFlags = async (ctx: any) => {
  const redis = await initializeRedis(getRedisConfig());
  if (!redis) return;

  const flags = await ctx.serverDB.select().from(featureFlags);
  const payload = Object.fromEntries(flags.map((f: any) => [f.key, !!f.defaultEnabled]));

  await redis.set(
    'runtime-config:feature-flags:published',
    JSON.stringify({ data: payload, updatedAt: new Date().toISOString(), version: Date.now() }),
  );
};

const publishUserFeatureOverrides = async (ctx: any, userId: string) => {
  const redis = await initializeRedis(getRedisConfig());
  if (!redis) return;

  const assignments = await ctx.serverDB
    .select()
    .from(featureFlagAssignments)
    .where(eq(featureFlagAssignments.userId, userId));

  const payload = Object.fromEntries(assignments.map((a: any) => [a.flagKey, !!a.enabled]));

  await redis.set(
    `runtime-config:feature-flags:user:${userId}`,
    JSON.stringify({ data: payload, updatedAt: new Date().toISOString(), version: Date.now() }),
  );
};

const governanceDomains = ['content', 'pricing', 'marketplace', 'image', 'video', 'audio'] as const;

export const adminRouter = router({
  getUsers: adminProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const userList = await ctx.serverDB
        .select()
        .from(users)
        .limit(input.limit)
        .offset(input.offset);
      const totalCount = await ctx.serverDB.query.users.findMany({});

      return {
        success: true,
        data: {
          limit: input.limit,
          offset: input.offset,
          total: totalCount.length,
          users: userList,
        },
      };
    }),

  banUser: adminProcedure
    .input(
      z.object({
        duration: z.number().optional(),
        reason: z.string().optional(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const banExpires = input.duration ? new Date(Date.now() + input.duration) : null;

      await ctx.serverDB
        .update(users)
        .set({ banExpires, banReason: input.reason || 'Banned by admin', banned: true })
        .where(eq(users.id, input.userId));

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'user.ban',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: { duration: input.duration, reason: input.reason },
        targetId: input.userId,
        targetType: 'user',
      });

      return { success: true };
    }),

  unbanUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .update(users)
        .set({ banExpires: null, banReason: null, banned: false })
        .where(eq(users.id, input.userId));

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'user.unban',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        targetId: input.userId,
        targetType: 'user',
      });

      return { success: true };
    }),

  updateUserRole: adminProcedure
    .input(z.object({ role: z.string().min(1), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.update(users).set({ role: input.role }).where(eq(users.id, input.userId));

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'user.role_update',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: { role: input.role },
        targetId: input.userId,
        targetType: 'user',
      });

      return { success: true };
    }),

  getFeatureFlags: adminProcedure.query(async ({ ctx }) => {
    const flags = await ctx.serverDB.select().from(featureFlags).orderBy(featureFlags.key);
    return { success: true, data: flags };
  }),

  createFeatureFlag: adminProcedure
    .input(
      z.object({
        defaultEnabled: z.boolean().default(false),
        description: z.string().optional(),
        key: z.string(),
        label: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newFlag = await ctx.serverDB
        .insert(featureFlags)
        .values({
          defaultEnabled: input.defaultEnabled,
          description: input.description,
          key: input.key,
          label: input.label,
        })
        .returning();

      await publishRuntimeFeatureFlags(ctx);

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'feature_flag.create',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: input,
        targetId: newFlag[0]?.id,
        targetType: 'feature_flag',
      });

      return { success: true, data: newFlag[0] };
    }),

  updateFeatureFlag: adminProcedure
    .input(
      z.object({
        defaultEnabled: z.boolean().optional(),
        description: z.string().optional(),
        flagId: z.string(),
        label: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.defaultEnabled !== undefined) updateData.defaultEnabled = input.defaultEnabled;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.label !== undefined) updateData.label = input.label;

      const updated = await ctx.serverDB
        .update(featureFlags)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(featureFlags.id, input.flagId))
        .returning();

      await publishRuntimeFeatureFlags(ctx);

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'feature_flag.update',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: input,
        targetId: input.flagId,
        targetType: 'feature_flag',
      });

      return { success: true, data: updated[0] };
    }),

  deleteFeatureFlag: adminProcedure
    .input(z.object({ flagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.delete(featureFlags).where(eq(featureFlags.id, input.flagId));
      await publishRuntimeFeatureFlags(ctx);

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'feature_flag.delete',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        targetId: input.flagId,
        targetType: 'feature_flag',
      });

      return { success: true };
    }),

  setUserFeatureFlag: adminProcedure
    .input(
      z.object({ enabled: z.boolean(), flagKey: z.string().min(1), userId: z.string().min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB
        .select()
        .from(featureFlagAssignments)
        .where(
          and(
            eq(featureFlagAssignments.userId, input.userId),
            eq(featureFlagAssignments.flagKey, input.flagKey),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await ctx.serverDB
          .update(featureFlagAssignments)
          .set({ enabled: input.enabled, updatedAt: new Date() })
          .where(eq(featureFlagAssignments.id, existing[0].id));
      } else {
        await ctx.serverDB.insert(featureFlagAssignments).values(input);
      }

      await publishUserFeatureOverrides(ctx, input.userId);

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'feature_flag.user_override',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: input,
        targetId: input.userId,
        targetType: 'user',
      });

      return { success: true };
    }),

  getUserFeatureFlags: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignments = await ctx.serverDB
        .select()
        .from(featureFlagAssignments)
        .where(eq(featureFlagAssignments.userId, input.userId));

      return { success: true, data: assignments };
    }),

  getAuditLogs: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
        targetType: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.serverDB.select().from(adminAuditLogs).$dynamic();

      if (input.action) query = query.where(eq(adminAuditLogs.action, input.action));
      if (input.targetType) query = query.where(eq(adminAuditLogs.targetType, input.targetType));

      const logs = await query
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return { success: true, data: logs };
    }),

  getSystemStats: adminProcedure.query(async ({ ctx }) => {
    const totalUsers = await ctx.serverDB.query.users.findMany({});
    const bannedUsers = totalUsers.filter((u) => u.banned);
    const envVars = await ctx.serverDB.select().from(adminEnvVars);
    const governancePolicies = await ctx.serverDB.select().from(adminGovernancePolicies);

    return {
      success: true,
      data: {
        activeGovernancePolicyCount: governancePolicies.filter((p) => p.isActive).length,
        bannedUserCount: bannedUsers.length,
        envVarCount: envVars.length,
        timestamp: new Date().toISOString(),
        totalUserCount: totalUsers.length,
      },
    };
  }),

  getAdminApiKeys: adminProcedure.query(async ({ ctx }) => {
    const keys = await ctx.serverDB.select().from(adminApiKeys).orderBy(adminApiKeys.service);
    return { success: true, data: keys };
  }),

  upsertAdminApiKey: adminProcedure
    .input(
      z.object({
        config: z.record(z.string(), z.unknown()).optional(),
        isActive: z.boolean().default(true),
        keyValue: z.string().min(1),
        label: z.string().min(1),
        service: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB
        .select()
        .from(adminApiKeys)
        .where(eq(adminApiKeys.service, input.service))
        .limit(1);

      if (existing.length > 0) {
        await ctx.serverDB
          .update(adminApiKeys)
          .set({
            config: input.config || {},
            isActive: input.isActive,
            keyValue: input.keyValue,
            label: input.label,
            updatedAt: new Date(),
          })
          .where(eq(adminApiKeys.service, input.service));
      } else {
        await ctx.serverDB.insert(adminApiKeys).values({
          config: input.config || {},
          isActive: input.isActive,
          keyValue: input.keyValue,
          label: input.label,
          service: input.service,
        });
      }

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'admin_api_key.upsert',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: { isActive: input.isActive, label: input.label, service: input.service },
        targetId: input.service,
        targetType: 'admin_api_key',
      });

      return { success: true };
    }),

  deleteAdminApiKey: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.delete(adminApiKeys).where(eq(adminApiKeys.id, input.id));
      return { success: true };
    }),

  getProviderOverview: adminProcedure.query(async ({ ctx }) => {
    const providers = await ctx.serverDB.select().from(aiProviders).limit(500);
    return { success: true, data: providers };
  }),

  getEnvVars: adminProcedure.query(async ({ ctx }) => {
    const vars = await ctx.serverDB
      .select()
      .from(adminEnvVars)
      .orderBy(adminEnvVars.domain, adminEnvVars.key);

    return { success: true, data: vars };
  }),

  upsertEnvVar: adminProcedure
    .input(
      z.object({
        description: z.string().optional(),
        domain: z.string().min(1),
        isActive: z.boolean().default(true),
        isSecret: z.boolean().default(true),
        key: z.string().min(1),
        value: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB
        .select()
        .from(adminEnvVars)
        .where(and(eq(adminEnvVars.domain, input.domain), eq(adminEnvVars.key, input.key)))
        .limit(1);

      if (existing[0]) {
        await ctx.serverDB
          .update(adminEnvVars)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(adminEnvVars.id, existing[0].id));
      } else {
        await ctx.serverDB.insert(adminEnvVars).values(input);
      }

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'env_var.upsert',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: { ...input, value: input.isSecret ? '***' : input.value },
        targetId: `${input.domain}:${input.key}`,
        targetType: 'env_var',
      });

      return { success: true };
    }),

  deleteEnvVar: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB.delete(adminEnvVars).where(eq(adminEnvVars.id, input.id));
      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'env_var.delete',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        targetId: input.id,
        targetType: 'env_var',
      });
      return { success: true };
    }),

  getGovernancePolicies: adminProcedure
    .input(z.object({ domain: z.enum(governanceDomains).optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.domain) {
        const rows = await ctx.serverDB
          .select()
          .from(adminGovernancePolicies)
          .where(eq(adminGovernancePolicies.domain, input.domain))
          .orderBy(adminGovernancePolicies.priority);
        return { success: true, data: rows };
      }

      const rows = await ctx.serverDB
        .select()
        .from(adminGovernancePolicies)
        .orderBy(adminGovernancePolicies.domain, adminGovernancePolicies.priority);

      return { success: true, data: rows };
    }),

  upsertGovernancePolicy: adminProcedure
    .input(
      z.object({
        config: z.record(z.string(), z.unknown()).default({}),
        domain: z.enum(governanceDomains),
        id: z.string().optional(),
        isActive: z.boolean().default(true),
        mode: z.enum(['allow', 'deny', 'review', 'throttle']).default('allow'),
        notes: z.string().optional(),
        priority: z.number().int().default(100),
        target: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        await ctx.serverDB
          .update(adminGovernancePolicies)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(adminGovernancePolicies.id, input.id));
      } else {
        await ctx.serverDB.insert(adminGovernancePolicies).values({
          config: input.config,
          domain: input.domain,
          isActive: input.isActive,
          mode: input.mode,
          notes: input.notes,
          priority: input.priority,
          target: input.target,
        });
      }

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'governance.upsert',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: input,
        targetId: input.id || `${input.domain}:${input.target}`,
        targetType: 'governance_policy',
      });

      return { success: true };
    }),

  deleteGovernancePolicy: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.serverDB
        .delete(adminGovernancePolicies)
        .where(eq(adminGovernancePolicies.id, input.id));

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'governance.delete',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        targetId: input.id,
        targetType: 'governance_policy',
      });

      return { success: true };
    }),
});

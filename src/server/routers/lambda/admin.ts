import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { adminApiKeys, adminAuditLogs, featureFlags } from '@/database/schemas/admin';
import { aiProviders } from '@/database/schemas/aiInfra';
import { users } from '@/database/schemas/user';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

/**
 * Admin middleware - checks if user is admin or has admin email
 */
const adminProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  // Check if user is admin
  const user = await ctx.serverDB.select().from(users).where(eq(users.id, ctx.userId)).limit(1);

  const currentUser = user[0];

  if (!currentUser) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not found',
    });
  }

  // Only allow admin role or specific admin email
  const isAdmin = currentUser.role === 'admin' || currentUser.email === 'pichimail24@gmail.com';

  if (!isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      adminId: ctx.userId,
      adminEmail: currentUser.email,
    },
  });
});

export const adminRouter = router({
  // ─────────────────── User Management ───────────────────

  /**
   * Get all users with optional pagination
   */
  getUsers: adminProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const userList = await ctx.serverDB
          .select()
          .from(users)
          .limit(input.limit)
          .offset(input.offset);

        const totalCount = await ctx.serverDB.query.users.findMany({});

        return {
          success: true,
          data: {
            users: userList,
            total: totalCount.length,
            limit: input.limit,
            offset: input.offset,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[adminRouter.getUsers] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
        });
      }
    }),

  /**
   * Ban a user
   */
  banUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        reason: z.string().optional(),
        duration: z.number().optional(), // milliseconds
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const banExpires = input.duration ? new Date(Date.now() + input.duration) : null;

        await ctx.serverDB
          .update(users)
          .set({
            banned: true,
            banReason: input.reason || 'Banned by admin',
            banExpires,
          })
          .where(eq(users.id, input.userId));

        // Log action
        await ctx.serverDB.insert(adminAuditLogs).values({
          action: 'user.ban',
          adminEmail: ctx.adminEmail,
          adminId: ctx.adminId,
          metadata: {
            duration: input.duration,
            reason: input.reason,
          },
          targetId: input.userId,
          targetType: 'user',
        });

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[adminRouter.banUser] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
        });
      }
    }),

  /**
   * Unban a user
   */
  unbanUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.serverDB
          .update(users)
          .set({
            banned: false,
            banReason: null,
            banExpires: null,
          })
          .where(eq(users.id, input.userId));

        // Log action
        await ctx.serverDB.insert(adminAuditLogs).values({
          action: 'user.unban',
          adminEmail: ctx.adminEmail,
          adminId: ctx.adminId,
          targetId: input.userId,
          targetType: 'user',
        });

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[adminRouter.unbanUser] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
        });
      }
    }),

  /**
   * Update user role
   */
  updateUserRole: adminProcedure
    .input(
      z.object({
        role: z.string().min(1),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.serverDB
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));

        await ctx.serverDB.insert(adminAuditLogs).values({
          action: 'user.role_update',
          adminEmail: ctx.adminEmail,
          adminId: ctx.adminId,
          metadata: { role: input.role },
          targetId: input.userId,
          targetType: 'user',
        });

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }),

  // ─────────────────── Feature Flags ───────────────────

  /**
   * Get all feature flags
   */
  getFeatureFlags: adminProcedure.query(async ({ ctx }) => {
    try {
      const flags = await ctx.serverDB.select().from(featureFlags).orderBy(featureFlags.key);

      return { success: true, data: flags };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[adminRouter.getFeatureFlags] Error:', error);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
      });
    }
  }),

  /**
   * Create a new feature flag
   */
  createFeatureFlag: adminProcedure
    .input(
      z.object({
        key: z.string(),
        label: z.string(),
        defaultEnabled: z.boolean().default(false),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const newFlag = await ctx.serverDB
          .insert(featureFlags)
          .values({
            defaultEnabled: input.defaultEnabled,
            description: input.description,
            key: input.key,
            label: input.label,
          })
          .returning();

        // Log action
        await ctx.serverDB.insert(adminAuditLogs).values({
          action: 'feature_flag.create',
          adminEmail: ctx.adminEmail,
          adminId: ctx.adminId,
          metadata: input,
          targetId: newFlag[0]?.id,
          targetType: 'feature_flag',
        });

        return { success: true, data: newFlag[0] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[adminRouter.createFeatureFlag] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
        });
      }
    }),

  /**
   * Update a feature flag
   */
  updateFeatureFlag: adminProcedure
    .input(
      z.object({
        flagId: z.string(),
        defaultEnabled: z.boolean().optional(),
        description: z.string().optional(),
        label: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updateData: Record<string, unknown> = {};

        if (input.defaultEnabled !== undefined) updateData.defaultEnabled = input.defaultEnabled;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.label !== undefined) updateData.label = input.label;

        const updated = await ctx.serverDB
          .update(featureFlags)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(featureFlags.id, input.flagId))
          .returning();

        // Log action
        await ctx.serverDB.insert(adminAuditLogs).values({
          action: 'feature_flag.update',
          adminEmail: ctx.adminEmail,
          adminId: ctx.adminId,
          metadata: input,
          targetId: input.flagId,
          targetType: 'feature_flag',
        });

        return { success: true, data: updated[0] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[adminRouter.updateFeatureFlag] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
        });
      }
    }),

  /**
   * Delete a feature flag
   */
  deleteFeatureFlag: adminProcedure
    .input(z.object({ flagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.serverDB.delete(featureFlags).where(eq(featureFlags.id, input.flagId));

        // Log action
        await ctx.serverDB.insert(adminAuditLogs).values({
          action: 'feature_flag.delete',
          adminEmail: ctx.adminEmail,
          adminId: ctx.adminId,
          targetId: input.flagId,
          targetType: 'feature_flag',
        });

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[adminRouter.deleteFeatureFlag] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
        });
      }
    }),

  // ─────────────────── Audit Logs ───────────────────

  /**
   * Get audit logs with filters
   */
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
      try {
        let query = ctx.serverDB.select().from(adminAuditLogs);

        if (input.action) {
          query = query.where(eq(adminAuditLogs.action, input.action));
        }

        if (input.targetType) {
          query = query.where(eq(adminAuditLogs.targetType, input.targetType));
        }

        const logs = await query
          .orderBy(desc(adminAuditLogs.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        return { success: true, data: logs };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[adminRouter.getAuditLogs] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
        });
      }
    }),

  // ─────────────────── System Stats ───────────────────

  /**
   * Get system statistics
   */
  getSystemStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const totalUsers = await ctx.serverDB.query.users.findMany({});
      const bannedUsers = totalUsers.filter((u) => u.banned);

      return {
        success: true,
        data: {
          bannedUserCount: bannedUsers.length,
          totalUserCount: totalUsers.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[adminRouter.getSystemStats] Error:', error);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
      });
    }
  }),

  // ─────────────────── Admin API Keys ───────────────────

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

  // ─────────────────── Provider Management ───────────────────

  getProviderOverview: adminProcedure.query(async ({ ctx }) => {
    const providers = await ctx.serverDB.select().from(aiProviders).limit(500);
    return { success: true, data: providers };
  }),
});

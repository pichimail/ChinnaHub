import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DEFAULT_MODEL_PROVIDER_LIST } from 'model-bank/modelProviders';
import { z } from 'zod';

import {
  adminApiKeys,
  adminAuditLogs,
  adminEnvVars,
  adminGovernancePolicies,
  adminPlanFeatures,
  adminPlans,
  adminUserPlans,
  featureFlagAssignments,
  featureFlags,
} from '@/database/schemas/admin';
import { aiProviders } from '@/database/schemas/aiInfra';
import { users } from '@/database/schemas/user';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis } from '@/libs/redis';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  buildRuntimeEnvCatalog,
  getRuntimeEnvImportValues,
  maskValue,
} from '@/server/services/admin/runtimeEnvCatalog';

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

  const [assignments, userPlanRows] = await Promise.all([
    ctx.serverDB
      .select()
      .from(featureFlagAssignments)
      .where(eq(featureFlagAssignments.userId, userId)),
    ctx.serverDB.select().from(adminUserPlans).where(eq(adminUserPlans.userId, userId)).limit(1),
  ]);

  const planKey = userPlanRows[0]?.planKey || 'starter';
  const planFeatures = await ctx.serverDB
    .select()
    .from(adminPlanFeatures)
    .where(eq(adminPlanFeatures.planKey, planKey));

  const planPayload = Object.fromEntries(planFeatures.map((f: any) => [f.flagKey, !!f.enabled]));
  const userPayload = Object.fromEntries(assignments.map((a: any) => [a.flagKey, !!a.enabled]));
  const payload = { ...planPayload, ...userPayload };

  await redis.set(
    `runtime-config:feature-flags:user:${userId}`,
    JSON.stringify({ data: payload, updatedAt: new Date().toISOString(), version: Date.now() }),
  );
};

const governanceDomains = [
  'content',
  'pricing',
  'marketplace',
  'image',
  'video',
  'audio',
  'provider',
] as const;

type OpenRouterModel = {
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
  created?: number;
  description?: string;
  id: string;
  name?: string;
  output_modalities?: string[];
};

const parseModalities = (model: OpenRouterModel) => {
  const output = [
    ...(model.output_modalities || []),
    ...(model.architecture?.output_modalities || []),
  ].map((item) => item.toLowerCase());
  const modality = model.architecture?.modality?.toLowerCase() || '';

  return {
    hasImage: output.includes('image') || modality.includes('image'),
    hasVideo: output.includes('video') || modality.includes('video'),
  };
};

const fetchOpenRouterModels = async (apiKey?: string) => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch('https://openrouter.ai/api/v1/models?output_modalities=all', {
    headers,
  });

  if (!response.ok) {
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: `OpenRouter model fetch failed (${response.status})`,
    });
  }

  const payload = (await response.json()) as { data?: OpenRouterModel[] };
  return payload.data || [];
};

const featureCatalog = [
  ['chat', 'Chat', 'Core chat and conversation access', true],
  ['agents', 'Agents', 'Create and use AI agents', true],
  ['agent_teams', 'Agent Teams', 'Group and orchestrate multiple agents', true],
  ['tasks', 'Tasks', 'Task workspace and automation controls', true],
  ['pages', 'Pages', 'Document and page workspace', true],
  ['resources', 'Resources', 'Personal resource and file library', true],
  ['market', 'Marketplace', 'Browse marketplace items, agents, skills, and MCP entries', true],
  ['skills', 'Skills', 'Install and run skills', true],
  ['mcp', 'MCP Connectors', 'Use MCP/plugin connectors', true],
  ['provider_settings', 'AI Providers', 'Manage AI provider settings', true],
  ['ai_models', 'AI Models', 'Access AI model picker and model catalog', true],
  ['api_key_manage', 'API Key Management', 'Manage personal API keys', false],
  ['ai_image', 'Image Generation', 'Generate images', true],
  ['ai_video', 'Video Generation', 'Generate videos', true],
  ['ai_audio', 'Audio Generation', 'Generate music and audio', true],
  ['audio_accoustica_classic', 'Accoustica Classic', 'KIE/Suno-backed music generation', true],
  [
    'audio_accoustica_lyria',
    'Accoustica Lyria',
    'OpenRouter-compatible Lyria music generation',
    false,
  ],
  ['channels', 'Messaging Channels', 'Connect external messenger channels', true],
  ['channel_discord', 'Discord Channel', 'Expose Discord bot channel', true],
  ['channel_telegram', 'Telegram Channel', 'Expose Telegram bot channel', true],
  ['channel_slack', 'Slack Channel', 'Expose Slack bot channel', true],
  ['channel_wechat', 'WeChat Channel', 'Expose WeChat bot channel', true],
  ['channel_line', 'LINE Channel', 'Expose LINE bot channel', true],
  ['channel_whatsapp', 'WhatsApp Channel', 'Expose WhatsApp QR channel', true],
  ['speech_to_text', 'Speech to Text', 'Voice transcription in chat', true],
  ['knowledge_base', 'Knowledge Base', 'Knowledge base and RAG access', true],
  ['rag_eval', 'RAG Evaluation', 'Knowledge base evaluation tooling', false],
  ['token_counter', 'Token Counter', 'Token usage helpers', true],
  ['welcome_suggest', 'Welcome Suggestions', 'Starter prompts and suggestions', true],
] as const;

const defaultPlans = [
  {
    config: { support: 'community' },
    description: 'Entry plan for normal chat and starter generation access.',
    key: 'starter',
    label: 'Starter',
    monthlyCredits: { audio: 5, chat: 1000, image: 50, video: 5 },
    sortOrder: 10,
  },
  {
    config: { support: 'priority' },
    description: 'Creator plan with expanded generation and marketplace access.',
    key: 'creator',
    label: 'Creator',
    monthlyCredits: { audio: 50, chat: 5000, image: 500, video: 50 },
    sortOrder: 20,
  },
  {
    config: { support: 'enterprise', governance: true },
    description: 'Enterprise plan with complete admin-governed feature access.',
    key: 'enterprise',
    label: 'Enterprise',
    monthlyCredits: { audio: 500, chat: 50_000, image: 5000, video: 500 },
    sortOrder: 30,
  },
] as const;

const planFeatureMatrix: Record<string, string[]> = {
  starter: [
    'chat',
    'agents',
    'tasks',
    'pages',
    'resources',
    'ai_image',
    'ai_audio',
    'audio_accoustica_classic',
    'channel_discord',
    'channel_telegram',
    'channel_slack',
    'speech_to_text',
    'knowledge_base',
    'token_counter',
    'welcome_suggest',
  ],
  creator: [
    'chat',
    'agents',
    'agent_teams',
    'tasks',
    'pages',
    'resources',
    'market',
    'skills',
    'mcp',
    'provider_settings',
    'ai_models',
    'ai_image',
    'ai_video',
    'ai_audio',
    'audio_accoustica_classic',
    'audio_accoustica_lyria',
    'channels',
    'channel_discord',
    'channel_telegram',
    'channel_slack',
    'channel_wechat',
    'channel_line',
    'channel_whatsapp',
    'speech_to_text',
    'knowledge_base',
    'rag_eval',
    'token_counter',
    'welcome_suggest',
  ],
  enterprise: featureCatalog.map(([key]) => key),
};

const ensureFeatureCatalog = async (ctx: any) => {
  const existing = await ctx.serverDB.select().from(featureFlags);
  const existingKeys = new Set(existing.map((flag: any) => flag.key));
  const missing = featureCatalog
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, label, description, defaultEnabled]) => ({
      defaultEnabled,
      description,
      key,
      label,
    }));

  if (missing.length > 0) {
    await ctx.serverDB.insert(featureFlags).values(missing);
    await publishRuntimeFeatureFlags(ctx);
  }
};

const ensureDefaultPlans = async (ctx: any) => {
  const existingPlans = await ctx.serverDB.select().from(adminPlans);
  const existingPlanKeys = new Set(existingPlans.map((plan: any) => plan.key));
  const missingPlans = defaultPlans.filter((plan) => !existingPlanKeys.has(plan.key));

  if (missingPlans.length > 0) {
    await ctx.serverDB.insert(adminPlans).values(missingPlans as any);
  }

  const existingFeatures = await ctx.serverDB.select().from(adminPlanFeatures);
  const existingFeatureKeys = new Set(
    existingFeatures.map((feature: any) => `${feature.planKey}:${feature.flagKey}`),
  );
  const missingFeatures = Object.entries(planFeatureMatrix)
    .flatMap(([planKey, flagKeys]) =>
      featureCatalog.map(([flagKey]) => ({
        enabled: flagKeys.includes(flagKey),
        flagKey,
        planKey,
      })),
    )
    .filter((feature) => !existingFeatureKeys.has(`${feature.planKey}:${feature.flagKey}`));

  if (missingFeatures.length > 0) {
    await ctx.serverDB.insert(adminPlanFeatures).values(missingFeatures);
  }
};

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

      const [plans, assignments] = await Promise.all([
        ctx.serverDB.select().from(adminUserPlans),
        ctx.serverDB.select().from(featureFlagAssignments),
      ]);
      const planByUser = new Map(plans.map((plan) => [plan.userId, plan.planKey]));
      const assignmentsByUser = assignments.reduce<Record<string, typeof assignments>>(
        (acc, assignment) => {
          acc[assignment.userId] ||= [];
          acc[assignment.userId].push(assignment);
          return acc;
        },
        {},
      );

      return {
        success: true,
        data: {
          limit: input.limit,
          offset: input.offset,
          total: totalCount.length,
          users: userList.map((user) => ({
            ...user,
            featureOverrides: assignmentsByUser[user.id] || [],
            planKey: planByUser.get(user.id) || 'starter',
          })),
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
    await ensureFeatureCatalog(ctx);
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

  getPlans: adminProcedure.query(async ({ ctx }) => {
    await ensureFeatureCatalog(ctx);
    await ensureDefaultPlans(ctx);

    const [plans, planFeatures, userPlans] = await Promise.all([
      ctx.serverDB.select().from(adminPlans).orderBy(adminPlans.sortOrder, adminPlans.key),
      ctx.serverDB.select().from(adminPlanFeatures).orderBy(adminPlanFeatures.planKey),
      ctx.serverDB.select().from(adminUserPlans),
    ]);

    return {
      success: true,
      data: { planFeatures, plans, userPlans },
    };
  }),

  upsertPlan: adminProcedure
    .input(
      z.object({
        config: z.record(z.string(), z.unknown()).default({}),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
        key: z.string().min(1),
        label: z.string().min(1),
        monthlyCredits: z
          .object({
            audio: z.number().int().nonnegative().optional(),
            chat: z.number().int().nonnegative().optional(),
            image: z.number().int().nonnegative().optional(),
            video: z.number().int().nonnegative().optional(),
          })
          .default({}),
        sortOrder: z.number().int().default(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB
        .select()
        .from(adminPlans)
        .where(eq(adminPlans.key, input.key))
        .limit(1);

      if (existing[0]) {
        await ctx.serverDB
          .update(adminPlans)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(adminPlans.id, existing[0].id));
      } else {
        await ctx.serverDB.insert(adminPlans).values(input);
      }

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'plan.upsert',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: input,
        targetId: input.key,
        targetType: 'admin_plan',
      });

      return { success: true };
    }),

  setPlanFeature: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        flagKey: z.string().min(1),
        limits: z.record(z.string(), z.unknown()).default({}),
        planKey: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB
        .select()
        .from(adminPlanFeatures)
        .where(
          and(
            eq(adminPlanFeatures.planKey, input.planKey),
            eq(adminPlanFeatures.flagKey, input.flagKey),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await ctx.serverDB
          .update(adminPlanFeatures)
          .set({ enabled: input.enabled, limits: input.limits, updatedAt: new Date() })
          .where(eq(adminPlanFeatures.id, existing[0].id));
      } else {
        await ctx.serverDB.insert(adminPlanFeatures).values(input);
      }

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'plan.feature_update',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: input,
        targetId: `${input.planKey}:${input.flagKey}`,
        targetType: 'admin_plan_feature',
      });

      return { success: true };
    }),

  assignUserPlan: adminProcedure
    .input(
      z.object({
        notes: z.string().optional(),
        planKey: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.serverDB
        .select()
        .from(adminUserPlans)
        .where(eq(adminUserPlans.userId, input.userId))
        .limit(1);

      if (existing[0]) {
        await ctx.serverDB
          .update(adminUserPlans)
          .set({
            assignedBy: ctx.adminId,
            notes: input.notes,
            planKey: input.planKey,
            updatedAt: new Date(),
          })
          .where(eq(adminUserPlans.id, existing[0].id));
      } else {
        await ctx.serverDB.insert(adminUserPlans).values({
          assignedBy: ctx.adminId,
          notes: input.notes,
          planKey: input.planKey,
          userId: input.userId,
        });
      }

      await publishUserFeatureOverrides(ctx, input.userId);

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'plan.user_assign',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: input,
        targetId: input.userId,
        targetType: 'user',
      });

      return { success: true };
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
    const [providers, policies] = await Promise.all([
      ctx.serverDB.select().from(aiProviders).limit(500),
      ctx.serverDB
        .select()
        .from(adminGovernancePolicies)
        .where(inArray(adminGovernancePolicies.domain, ['image', 'video', 'audio'])),
    ]);
    return { success: true, data: { policies, providers } };
  }),

  getOpenRouterGenerationModels: adminProcedure.query(async ({ ctx }) => {
    const [envRows, keyRows] = await Promise.all([
      ctx.serverDB
        .select()
        .from(adminEnvVars)
        .where(and(eq(adminEnvVars.key, 'OPENROUTER_API_KEY'), eq(adminEnvVars.isActive, true)))
        .limit(1),
      ctx.serverDB
        .select()
        .from(adminApiKeys)
        .where(and(eq(adminApiKeys.service, 'openrouter'), eq(adminApiKeys.isActive, true)))
        .limit(1),
    ]);
    const apiKey = keyRows[0]?.keyValue || envRows[0]?.value || process.env.OPENROUTER_API_KEY;
    const models = await fetchOpenRouterModels(apiKey);
    const mapped = models
      .map((model) => {
        const modalities = parseModalities(model);
        return {
          created: model.created,
          description: model.description,
          id: model.id,
          name: model.name || model.id,
          type: modalities.hasVideo ? 'video' : modalities.hasImage ? 'image' : 'other',
        };
      })
      .filter((model) => model.type !== 'other');

    return { success: true, data: mapped };
  }),

  getEnvVars: adminProcedure.query(async ({ ctx }) => {
    const vars = await ctx.serverDB
      .select()
      .from(adminEnvVars)
      .orderBy(adminEnvVars.domain, adminEnvVars.key);

    return { success: true, data: vars };
  }),

  getRuntimeEnvCatalog: adminProcedure.query(async ({ ctx }) => {
    const vars = await ctx.serverDB.select().from(adminEnvVars);
    return { success: true, data: buildRuntimeEnvCatalog(vars) };
  }),

  importRuntimeEnvVars: adminProcedure
    .input(
      z
        .object({
          keys: z.array(z.string()).optional(),
          overwrite: z.boolean().default(false),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const candidates = getRuntimeEnvImportValues(input?.keys);
      let imported = 0;
      let skipped = 0;

      for (const candidate of candidates) {
        const existing = await ctx.serverDB
          .select()
          .from(adminEnvVars)
          .where(
            and(eq(adminEnvVars.domain, candidate.domain), eq(adminEnvVars.key, candidate.key)),
          )
          .limit(1);

        if (existing[0] && !input?.overwrite) {
          skipped += 1;
          continue;
        }

        if (existing[0]) {
          await ctx.serverDB
            .update(adminEnvVars)
            .set({
              description: candidate.description,
              isActive: true,
              isSecret: candidate.isSecret,
              updatedAt: new Date(),
              value: candidate.value,
            })
            .where(eq(adminEnvVars.id, existing[0].id));
        } else {
          await ctx.serverDB.insert(adminEnvVars).values({
            description: candidate.description,
            domain: candidate.domain,
            isActive: true,
            isSecret: candidate.isSecret,
            key: candidate.key,
            value: candidate.value,
          });
        }
        imported += 1;
      }

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'env_var.import_runtime',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: {
          imported,
          keys: candidates.map((item) => item.key),
          skipped,
          values: Object.fromEntries(candidates.map((item) => [item.key, maskValue(item.value)])),
        },
        targetType: 'env_var',
      });

      return { success: true, data: { imported, skipped } };
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

  // ── Global Provider Settings ─────────────────────────────────────────────

  getGlobalProviderSettings: adminProcedure.query(async ({ ctx }) => {
    const [policies, envRows] = await Promise.all([
      ctx.serverDB
        .select()
        .from(adminGovernancePolicies)
        .where(
          and(
            eq(adminGovernancePolicies.domain, 'provider'),
            eq(adminGovernancePolicies.isActive, true),
          ),
        ),
      ctx.serverDB
        .select()
        .from(adminEnvVars)
        .where(and(eq(adminEnvVars.domain, 'provider'), eq(adminEnvVars.isActive, true))),
    ]);

    const disabledSet = new Set(policies.filter((p) => p.mode === 'deny').map((p) => p.target));
    const labelMap = new Map(
      envRows
        .filter((r) => r.key.startsWith('LABEL_'))
        .map((r) => [r.key.replace('LABEL_', ''), r.value]),
    );
    const logoMap = new Map(
      envRows
        .filter((r) => r.key.startsWith('LOGO_'))
        .map((r) => [r.key.replace('LOGO_', ''), r.value]),
    );

    // Build a fully merged provider list (all built-ins + admin overrides)
    const providers = DEFAULT_MODEL_PROVIDER_LIST.map((item) => ({
      description: item.description,
      enabled: !disabledSet.has(item.id),
      id: item.id,
      logo: logoMap.get(item.id) ?? (item as any).logo ?? null,
      name: labelMap.get(item.id) ?? item.name,
      originalName: item.name,
    }));

    return {
      success: true,
      data: {
        providers,
      },
    };
  }),

  upsertGlobalProviderSetting: adminProcedure
    .input(
      z.object({
        customLabel: z.string().optional(),
        customLogo: z.string().optional(),
        enabled: z.boolean(),
        providerId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { providerId, enabled, customLabel, customLogo } = input;

      // ── 1. Handle enabled/disabled via governance policy ──
      const existing = await ctx.serverDB
        .select()
        .from(adminGovernancePolicies)
        .where(
          and(
            eq(adminGovernancePolicies.domain, 'provider'),
            eq(adminGovernancePolicies.target, providerId),
            eq(adminGovernancePolicies.mode, 'deny'),
          ),
        )
        .limit(1);

      if (!enabled) {
        // Create or reactivate a deny policy
        if (existing[0]) {
          await ctx.serverDB
            .update(adminGovernancePolicies)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(adminGovernancePolicies.id, existing[0].id));
        } else {
          await ctx.serverDB.insert(adminGovernancePolicies).values({
            domain: 'provider',
            isActive: true,
            mode: 'deny',
            notes: `Provider ${providerId} disabled by admin`,
            priority: 1,
            target: providerId,
          });
        }
      } else {
        // Remove deny policy (re-enable)
        if (existing[0]) {
          await ctx.serverDB
            .delete(adminGovernancePolicies)
            .where(eq(adminGovernancePolicies.id, existing[0].id));
        }
      }

      // ── 2. Handle custom label ──
      const upsertEnvVar = async (key: string, value: string | undefined) => {
        const fullKey = `${key}_${providerId}`;
        const row = await ctx.serverDB
          .select()
          .from(adminEnvVars)
          .where(and(eq(adminEnvVars.domain, 'provider'), eq(adminEnvVars.key, fullKey)))
          .limit(1);

        if (!value) {
          if (row[0]) await ctx.serverDB.delete(adminEnvVars).where(eq(adminEnvVars.id, row[0].id));
          return;
        }

        if (row[0]) {
          await ctx.serverDB
            .update(adminEnvVars)
            .set({ isActive: true, updatedAt: new Date(), value })
            .where(eq(adminEnvVars.id, row[0].id));
        } else {
          await ctx.serverDB.insert(adminEnvVars).values({
            domain: 'provider',
            isActive: true,
            isSecret: false,
            key: fullKey,
            value,
          });
        }
      };

      await Promise.all([
        upsertEnvVar('LABEL', customLabel ?? undefined),
        upsertEnvVar('LOGO', customLogo ?? undefined),
      ]);

      await ctx.serverDB.insert(adminAuditLogs).values({
        action: 'provider.upsert_setting',
        adminEmail: ctx.adminEmail,
        adminId: ctx.adminId,
        metadata: { customLabel, customLogo, enabled, providerId },
        targetId: providerId,
        targetType: 'provider_setting',
      });

      return { success: true };
    }),
});

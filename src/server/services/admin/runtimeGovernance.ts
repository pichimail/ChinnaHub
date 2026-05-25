import { and, asc, eq } from 'drizzle-orm';

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
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis } from '@/libs/redis';

interface GovernanceInput {
  domain: 'audio' | 'content' | 'image' | 'marketplace' | 'pricing' | 'video';
  target: string;
  userId?: string;
}

interface ContentPolicyCheckInput {
  contextTarget: string;
  domain?: 'audio' | 'chat' | 'image' | 'video';
  text: string;
  userId?: string;
}

const targetMatches = (ruleTarget: string, target: string) => {
  if (ruleTarget === '*') return true;
  if (ruleTarget === target) return true;
  if (ruleTarget.endsWith('*')) return target.startsWith(ruleTarget.slice(0, -1));
  return false;
};

const getThrottleBucket = (windowSeconds: number) =>
  Math.floor(Date.now() / (windowSeconds * 1000));

export const enforceGovernancePolicy = async (
  db: any,
  input: GovernanceInput,
): Promise<{
  allowed: boolean;
  mode?: string;
  policyId?: string;
  reason?: string;
  target?: string;
}> => {
  if (typeof db?.select !== 'function') {
    return { allowed: true };
  }

  let policies = [];
  try {
    policies = await db
      .select()
      .from(adminGovernancePolicies)
      .where(
        and(
          eq(adminGovernancePolicies.domain, input.domain),
          eq(adminGovernancePolicies.isActive, true),
        ),
      )
      .orderBy(asc(adminGovernancePolicies.priority));
  } catch (error: any) {
    if (error?.code !== '42P01' && error?.cause?.code !== '42P01') throw error;
  }

  for (const policy of policies) {
    if (!targetMatches(policy.target, input.target)) continue;

    if (policy.mode === 'deny' || policy.mode === 'review') {
      return {
        allowed: false,
        mode: policy.mode,
        policyId: policy.id,
        reason:
          policy.notes ||
          `Blocked by governance policy (${policy.domain}:${policy.target}, mode=${policy.mode})`,
        target: policy.target,
      };
    }

    if (policy.mode === 'throttle') {
      const config = (policy.config || {}) as Record<string, unknown>;
      const maxRequests = Number(config.maxRequests || 0);
      const windowSeconds = Number(config.windowSeconds || 60);

      if (maxRequests > 0 && windowSeconds > 0) {
        const redis = await initializeRedis(getRedisConfig());
        if (redis) {
          const actor = input.userId || 'anonymous';
          const bucket = getThrottleBucket(windowSeconds);
          const key = `governance:throttle:${input.domain}:${policy.target}:${actor}:${bucket}`;
          const used = await redis.incr(key);
          if (used === 1) {
            await redis.expire(key, windowSeconds + 5);
          }

          if (used > maxRequests) {
            return {
              allowed: false,
              mode: policy.mode,
              policyId: policy.id,
              reason:
                policy.notes ||
                `Rate limited by governance policy (${policy.domain}:${policy.target})`,
              target: policy.target,
            };
          }
        }
      }
    }
  }

  return { allowed: true };
};

export const writeGovernanceEnforcementAudit = async (
  db: any,
  payload: {
    action: 'governance.content_block' | 'governance.policy_block' | 'governance.policy_throttle';
    metadata?: Record<string, unknown>;
    reason?: string;
    targetId?: string;
    userId: string;
  },
) => {
  await db.insert(adminAuditLogs).values({
    action: payload.action,
    adminEmail: null,
    adminId: payload.userId,
    metadata: {
      reason: payload.reason,
      ...payload.metadata,
    },
    targetId: payload.targetId,
    targetType: 'governance_enforcement',
  });
};

const containsMatch = (text: string, needle: string) =>
  text.toLowerCase().includes(needle.toLowerCase());

export const enforceContentTextPolicy = async (
  db: any,
  input: ContentPolicyCheckInput,
): Promise<{ allowed: boolean; policyId?: string; reason?: string; target?: string }> => {
  if (typeof db?.select !== 'function') {
    return { allowed: true };
  }

  let contentPolicies = [];
  try {
    contentPolicies = await db
      .select()
      .from(adminGovernancePolicies)
      .where(
        and(
          eq(adminGovernancePolicies.domain, 'content'),
          eq(adminGovernancePolicies.isActive, true),
        ),
      )
      .orderBy(asc(adminGovernancePolicies.priority));
  } catch (error: any) {
    if (error?.code !== '42P01' && error?.cause?.code !== '42P01') throw error;
  }

  for (const policy of contentPolicies) {
    if (!targetMatches(policy.target, input.contextTarget) && !targetMatches(policy.target, '*'))
      continue;

    const config = (policy.config || {}) as Record<string, unknown>;
    const blockedPhrases = (config.blockedPhrases || []) as string[];
    const blockedRegexes = (config.blockedRegexes || []) as string[];
    const maxPromptLength = Number(config.maxPromptLength || 0);

    if (maxPromptLength > 0 && input.text.length > maxPromptLength) {
      return {
        allowed: false,
        policyId: policy.id,
        reason: policy.notes || `Content exceeded max length (${maxPromptLength})`,
        target: policy.target,
      };
    }

    if (blockedPhrases.some((phrase) => phrase && containsMatch(input.text, phrase))) {
      return {
        allowed: false,
        policyId: policy.id,
        reason: policy.notes || 'Content blocked by policy phrase match',
        target: policy.target,
      };
    }

    for (const pattern of blockedRegexes) {
      if (!pattern) continue;
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(input.text)) {
          return {
            allowed: false,
            policyId: policy.id,
            reason: policy.notes || 'Content blocked by policy regex match',
            target: policy.target,
          };
        }
      } catch {
        // ignore malformed policy regex instead of failing all requests
      }
    }
  }

  return { allowed: true };
};

export const getManagedApiKey = async (db: any, service: string): Promise<string | null> => {
  try {
    const rows = await db
      .select()
      .from(adminApiKeys)
      .where(and(eq(adminApiKeys.service, service), eq(adminApiKeys.isActive, true)))
      .limit(1);

    return rows[0]?.keyValue || null;
  } catch (error: any) {
    if (error?.code === '42P01' || error?.cause?.code === '42P01') return null;
    throw error;
  }
};

export const getManagedEnvVar = async (
  db: any,
  key: string,
  domain = 'global',
): Promise<string | null> => {
  try {
    const rows = await db
      .select()
      .from(adminEnvVars)
      .where(
        and(
          eq(adminEnvVars.key, key),
          eq(adminEnvVars.domain, domain),
          eq(adminEnvVars.isActive, true),
        ),
      )
      .limit(1);

    return rows[0]?.value || null;
  } catch (error: any) {
    if (error?.code === '42P01' || error?.cause?.code === '42P01') return null;
    throw error;
  }
};

export const resolveUserFeatureAccess = async (
  db: any,
  input: { flagKey: string; userId: string },
): Promise<{
  allowed: boolean;
  flagKey: string;
  planKey?: string;
  reason?: string;
  source: 'default' | 'missing' | 'plan' | 'user_override';
}> => {
  if (typeof db?.select !== 'function') {
    return { allowed: true, flagKey: input.flagKey, source: 'missing' };
  }

  try {
    const [assignmentRows, planRows, flagRows] = await Promise.all([
      db
        .select()
        .from(featureFlagAssignments)
        .where(
          and(
            eq(featureFlagAssignments.userId, input.userId),
            eq(featureFlagAssignments.flagKey, input.flagKey),
          ),
        )
        .limit(1),
      db.select().from(adminUserPlans).where(eq(adminUserPlans.userId, input.userId)).limit(1),
      db.select().from(featureFlags).where(eq(featureFlags.key, input.flagKey)).limit(1),
    ]);

    const assignment = assignmentRows[0];
    if (assignment) {
      return {
        allowed: !!assignment.enabled,
        flagKey: input.flagKey,
        reason: assignment.enabled ? undefined : `${input.flagKey} is disabled for this user`,
        source: 'user_override',
      };
    }

    const planKey = planRows[0]?.planKey || 'starter';
    const [planFeatureRows, planStatusRows] = await Promise.all([
      db
        .select()
        .from(adminPlanFeatures)
        .where(
          and(eq(adminPlanFeatures.planKey, planKey), eq(adminPlanFeatures.flagKey, input.flagKey)),
        )
        .limit(1),
      db.select().from(adminPlans).where(eq(adminPlans.key, planKey)).limit(1),
    ]);

    if (planStatusRows[0] && !planStatusRows[0].isActive) {
      return {
        allowed: false,
        flagKey: input.flagKey,
        planKey,
        reason: `Plan ${planKey} is inactive`,
        source: 'plan',
      };
    }

    const planFeature = planFeatureRows[0];
    if (planFeature) {
      return {
        allowed: !!planFeature.enabled,
        flagKey: input.flagKey,
        planKey,
        reason: planFeature.enabled ? undefined : `${input.flagKey} is not enabled for ${planKey}`,
        source: 'plan',
      };
    }

    const flag = flagRows[0];
    return {
      allowed: !!flag?.defaultEnabled,
      flagKey: input.flagKey,
      planKey,
      reason: flag?.defaultEnabled ? undefined : `${input.flagKey} is disabled`,
      source: flag ? 'default' : 'missing',
    };
  } catch (error: any) {
    if (error?.code === '42P01' || error?.cause?.code === '42P01') {
      return { allowed: true, flagKey: input.flagKey, source: 'missing' };
    }
    throw error;
  }
};

export const enforceUserFeatureAccess = async (
  db: any,
  input: { flagKey: string; label: string; userId: string },
) => {
  const access = await resolveUserFeatureAccess(db, input);

  if (!access.allowed) {
    await writeGovernanceEnforcementAudit(db, {
      action: 'governance.policy_block',
      metadata: {
        flagKey: input.flagKey,
        planKey: access.planKey,
        source: access.source,
      },
      reason: access.reason,
      targetId: input.flagKey,
      userId: input.userId,
    });
  }

  return access.allowed
    ? access
    : {
        ...access,
        reason: access.reason || `${input.label} is not available for this user`,
      };
};

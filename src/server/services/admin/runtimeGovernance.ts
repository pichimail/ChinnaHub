import { and, asc, eq } from 'drizzle-orm';

import {
  adminApiKeys,
  adminAuditLogs,
  adminEnvVars,
  adminGovernancePolicies,
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

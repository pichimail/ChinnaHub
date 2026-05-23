import { and, asc, eq } from 'drizzle-orm';

import { adminApiKeys, adminEnvVars, adminGovernancePolicies } from '@/database/schemas/admin';
import { getRedisConfig } from '@/envs/redis';
import { initializeRedis } from '@/libs/redis';

interface GovernanceInput {
  domain: 'audio' | 'content' | 'image' | 'marketplace' | 'pricing' | 'video';
  target: string;
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
): Promise<{ allowed: boolean; reason?: string }> => {
  const policies = await db
    .select()
    .from(adminGovernancePolicies)
    .where(
      and(
        eq(adminGovernancePolicies.domain, input.domain),
        eq(adminGovernancePolicies.isActive, true),
      ),
    )
    .orderBy(asc(adminGovernancePolicies.priority));

  for (const policy of policies) {
    if (!targetMatches(policy.target, input.target)) continue;

    if (policy.mode === 'deny' || policy.mode === 'review') {
      return {
        allowed: false,
        reason:
          policy.notes ||
          `Blocked by governance policy (${policy.domain}:${policy.target}, mode=${policy.mode})`,
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
              reason:
                policy.notes ||
                `Rate limited by governance policy (${policy.domain}:${policy.target})`,
            };
          }
        }
      }
    }
  }

  return { allowed: true };
};

export const getManagedApiKey = async (db: any, service: string): Promise<string | null> => {
  const rows = await db
    .select()
    .from(adminApiKeys)
    .where(and(eq(adminApiKeys.service, service), eq(adminApiKeys.isActive, true)))
    .limit(1);

  return rows[0]?.keyValue || null;
};

export const getManagedEnvVar = async (
  db: any,
  key: string,
  domain = 'global',
): Promise<string | null> => {
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
};

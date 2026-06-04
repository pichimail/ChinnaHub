'use client';

import { Avatar, Block, Flexbox, Text } from '@lobehub/ui';
import { Spin } from 'antd';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import OpeningQuestions from '@/features/AgentHome/OpeningQuestions';
import { lambdaClient } from '@/libs/trpc/client';

type Snapshot = {
  apis: {
    services: Array<{
      isActive: boolean;
      label: string;
      service: string;
      updatedAt: Date | string;
    }>;
  };
  application: {
    appUrl: string | null;
    generatedAt: string;
    missingRuntimeEnvKeys: string[];
    runtimeCatalogCount: number;
    storageConfigured: boolean;
    trackedEnvVarCount: number;
    webhookProxyUrl: string | null;
  };
  audit: {
    recent: Array<{
      action: string;
      adminEmail: string | null;
      createdAt: Date | string;
      targetId: string | null;
      targetType: string | null;
    }>;
  };
  env: {
    runtimeCoverage: Array<{
      domain: string;
      hasAdminValue: boolean;
      hasProcessValue: boolean;
      issues: string[];
      key: string;
      requiredFor: string[];
      source: 'admin' | 'missing' | 'process';
    }>;
  };
  governance: {
    domains: Array<{
      activeCount: number;
      domain: string;
      totalCount: number;
    }>;
  };
  plans: {
    items: Array<{
      isActive: boolean;
      key: string;
      label: string;
      sortOrder: number;
    }>;
  };
  providers: {
    items: Array<{
      enabled: boolean;
      id: string;
      name: string;
      source: string;
      updatedAt: Date | string;
    }>;
  };
  summary: {
    activeApiKeyCount: number;
    activeGovernancePolicyCount: number;
    activePlanCount: number;
    activeProviderCount: number;
    adminUserCount: number;
    bannedUserCount: number;
    defaultEnabledFeatureFlagCount: number;
    envVarCount: number;
    featureFlagCount: number;
    totalUserCount: number;
  };
  users: {
    recent: Array<{
      banned: boolean;
      createdAt: Date | string;
      email: string | null;
      id: string;
      lastActiveAt: Date | string;
      role: string | null;
    }>;
  };
};

const styles = createStaticStyles(({ css }) => ({
  badge: css`
    padding-block: 6px;
    padding-inline: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    line-height: 1;
  `,
  badgeRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  card: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
  `,
  cardGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    width: 100%;

    @media (max-width: 900px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  description: css`
    max-width: 760px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 15px;
    line-height: 1.6;
  `,
  itemLine: css`
    overflow: hidden;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    line-height: 1.5;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  loading: css`
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.72);
  `,
  root: css`
    width: 100%;
    padding-block-end: 16px;
  `,
  sectionGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    width: 100%;

    @media (max-width: 1080px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  sectionTitle: css`
    margin: 0;
    color: rgba(255, 255, 255, 0.92);
    font-size: 14px;
    font-weight: 700;
  `,
  statLabel: css`
    color: rgba(255, 255, 255, 0.58);
    font-size: 12px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  `,
  statValue: css`
    color: #fff;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  `,
  title: css`
    color: #fff;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
  `,
}));

const formatDate = (value?: Date | string | null) => {
  if (!value) return 'n/a';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const AdminAssistantWelcome = memo(() => {
  const { t } = useTranslation('admin');
  const { data, isLoading } = useSWR(
    'admin:assistant-snapshot',
    async () => {
      const result = await lambdaClient.admin.getAssistantSnapshot.query();
      return result.data as Snapshot;
    },
    { revalidateOnFocus: false },
  );

  const promptQuestions = [
    t('assistantPromptReport'),
    t('assistantPromptUsers'),
    t('assistantPromptApis'),
    t('assistantPromptRoadmap'),
  ];

  return (
    <>
      <Flexbox flex={1} />
      <Flexbox className={styles.root} gap={16}>
        <Avatar avatar="/avatars/lobe-ai.png" shape={'square'} size={78} />
        <Text className={styles.title}>{t('assistantTitle')}</Text>
        <Text className={styles.description}>{t('assistantDescription')}</Text>

        {isLoading ? (
          <div className={styles.loading}>
            <Spin size="small" />
            <span>{t('assistantApplication')}</span>
          </div>
        ) : null}

        {data ? (
          <>
            <div className={styles.badgeRow}>
              {data.application.appUrl ? <span className={styles.badge}>{data.application.appUrl}</span> : null}
              {data.application.webhookProxyUrl ? (
                <span className={styles.badge}>{data.application.webhookProxyUrl}</span>
              ) : null}
              <span className={styles.badge}>
                {t('assistantStorageReady')}: {data.application.storageConfigured ? 'Yes' : 'No'}
              </span>
              <span className={styles.badge}>
                {t('assistantMissingEnv')}: {data.application.missingRuntimeEnvKeys.length}
              </span>
            </div>

            <div className={styles.cardGrid}>
              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantApplication')}</p>
                <span className={styles.statValue}>{data.summary.envVarCount}</span>
                <span className={styles.statLabel}>
                  {data.application.runtimeCatalogCount} tracked runtime requirements
                </span>
                <span className={styles.itemLine}>Generated {formatDate(data.application.generatedAt)}</span>
              </div>

              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantUsers')}</p>
                <span className={styles.statValue}>{data.summary.totalUserCount}</span>
                <span className={styles.statLabel}>
                  {data.summary.adminUserCount} admins, {data.summary.bannedUserCount} banned
                </span>
                <span className={styles.itemLine}>{data.users.recent[0]?.email || t('assistantNoUsers')}</span>
              </div>

              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantApis')}</p>
                <span className={styles.statValue}>{data.summary.activeApiKeyCount}</span>
                <span className={styles.statLabel}>
                  {data.summary.activeProviderCount} active providers
                </span>
                <span className={styles.itemLine}>
                  {data.apis.services.slice(0, 3).map((item) => item.service).join(', ') || 'n/a'}
                </span>
              </div>

              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantGovernance')}</p>
                <span className={styles.statValue}>{data.summary.activeGovernancePolicyCount}</span>
                <span className={styles.statLabel}>
                  {data.summary.featureFlagCount} flags, {data.summary.activePlanCount} active plans
                </span>
                <span className={styles.itemLine}>
                  {data.governance.domains
                    .filter((item) => item.activeCount > 0)
                    .map((item) => `${item.domain}:${item.activeCount}`)
                    .join(' | ') || 'n/a'}
                </span>
              </div>
            </div>

            <div className={styles.sectionGrid}>
              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantRecentUsers')}</p>
                {data.users.recent.length > 0 ? (
                  data.users.recent.map((user) => (
                    <span className={styles.itemLine} key={user.id}>
                      {user.email || user.id} · {user.role || 'user'} · {formatDate(user.lastActiveAt)}
                    </span>
                  ))
                ) : (
                  <span className={styles.itemLine}>{t('assistantNoUsers')}</span>
                )}
              </div>

              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantApis')}</p>
                {data.apis.services.slice(0, 6).map((service) => (
                  <span className={styles.itemLine} key={service.service}>
                    {service.service} · {service.isActive ? 'active' : 'inactive'} · {formatDate(service.updatedAt)}
                  </span>
                ))}
                {data.providers.items.slice(0, 3).map((provider) => (
                  <span className={styles.itemLine} key={provider.id}>
                    {provider.name} · {provider.enabled ? 'enabled' : 'disabled'} · {provider.source}
                  </span>
                ))}
              </div>

              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantAudit')}</p>
                {data.audit.recent.length > 0 ? (
                  data.audit.recent.map((item, index) => (
                    <span className={styles.itemLine} key={`${item.action}-${index}`}>
                      {item.action} · {item.adminEmail || 'admin'} · {formatDate(item.createdAt)}
                    </span>
                  ))
                ) : (
                  <span className={styles.itemLine}>{t('assistantNoAudit')}</span>
                )}
              </div>
            </div>

            <div className={styles.sectionGrid}>
              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantRuntime')}</p>
                {data.env.runtimeCoverage.map((item) => (
                  <span className={styles.itemLine} key={`${item.domain}:${item.key}`}>
                    {item.key} · {item.source} · {item.issues[0] || item.requiredFor.join(', ')}
                  </span>
                ))}
              </div>

              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantPlans')}</p>
                {data.plans.items.map((plan) => (
                  <span className={styles.itemLine} key={plan.key}>
                    {plan.label} · {plan.isActive ? 'active' : 'inactive'} · priority {plan.sortOrder}
                  </span>
                ))}
              </div>

              <div className={styles.card}>
                <p className={styles.sectionTitle}>{t('assistantGovernance')}</p>
                {data.governance.domains.map((item) => (
                  <span className={styles.itemLine} key={item.domain}>
                    {item.domain} · {item.activeCount}/{item.totalCount} active
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <Block variant={'outlined'}>
          <OpeningQuestions questions={promptQuestions} />
        </Block>
      </Flexbox>
    </>
  );
});

AdminAssistantWelcome.displayName = 'AdminAssistantWelcome';

export default AdminAssistantWelcome;

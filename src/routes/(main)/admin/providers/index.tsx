'use client';

import { Badge, Button, message, Space, Spin, Switch, Table, Tabs, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

type ProviderRow = {
  enabled?: boolean;
  id: string;
  name?: string | null;
  userId: string;
};

type GovernancePolicy = {
  domain: 'audio' | 'image' | 'video';
  id: string;
  isActive: boolean;
  mode: string;
  target: string;
};

type OpenRouterModelRow = {
  description?: string;
  id: string;
  name: string;
  type: 'image' | 'video';
};

const AdminProvidersPage = () => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();

  const { data, isLoading } = useSWR('admin:providers', async () => {
    const result = await lambdaClient.admin.getProviderOverview.query();
    return (result.data || { policies: [], providers: [] }) as {
      policies: GovernancePolicy[];
      providers: ProviderRow[];
    };
  });

  const { data: openRouterModels, isLoading: isModelLoading } = useSWR(
    'admin:providers:openrouter-generation-models',
    async () => {
      const result = await lambdaClient.admin.getOpenRouterGenerationModels.query();
      return (result.data || []) as OpenRouterModelRow[];
    },
    { revalidateOnFocus: false },
  );

  const setModelAvailability = async (
    domain: 'image' | 'video',
    modelId: string,
    available: boolean,
  ) => {
    const target = `provider:openrouter:model:${modelId}`;
    const existing = data?.policies.find(
      (policy) => policy.domain === domain && policy.target === target && policy.mode === 'deny',
    );

    try {
      if (available && existing) {
        await lambdaClient.admin.deleteGovernancePolicy.mutate({ id: existing.id });
      }

      if (!available) {
        await lambdaClient.admin.upsertGovernancePolicy.mutate({
          domain,
          isActive: true,
          mode: 'deny',
          notes: `Disabled from provider management for ${domain} generation`,
          priority: 10,
          target,
        });
      }

      message.success('Provider availability updated');
      mutate('admin:providers');
    } catch {
      message.error('Provider availability update failed');
    }
  };

  const isModelAvailable = (domain: 'image' | 'video', modelId: string) => {
    const target = `provider:openrouter:model:${modelId}`;
    return !data?.policies.some(
      (policy) =>
        policy.domain === domain &&
        policy.target === target &&
        policy.mode === 'deny' &&
        policy.isActive,
    );
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <h2>{t('providerManagement', { ns: 'admin' })}</h2>
      <Tabs
        items={[
          {
            key: 'providers',
            label: 'Configured Providers',
            children: (
              <Table
                dataSource={data?.providers || []}
                rowKey={(row) => `${row.id}:${row.userId}`}
                columns={[
                  { dataIndex: 'id', key: 'id', title: 'Provider ID' },
                  { dataIndex: 'name', key: 'name', title: t('label', { ns: 'admin' }) },
                  {
                    dataIndex: 'enabled',
                    key: 'enabled',
                    title: 'Enabled',
                    render: (enabled: boolean) =>
                      enabled ? (
                        <Badge status="success" text={t('yes', { ns: 'admin' })} />
                      ) : (
                        <Badge status="default" text={t('no', { ns: 'admin' })} />
                      ),
                  },
                  {
                    dataIndex: 'userId',
                    key: 'userId',
                    title: 'Owner',
                    render: (id: string) => id?.slice(0, 8),
                  },
                ]}
              />
            ),
          },
          {
            key: 'openrouter-models',
            label: 'OpenRouter Generation Models',
            children: (
              <Table
                dataSource={openRouterModels || []}
                loading={isModelLoading}
                rowKey={(row) => `${row.type}:${row.id}`}
                columns={[
                  { dataIndex: 'name', key: 'name', title: 'Model' },
                  { dataIndex: 'id', key: 'id', title: 'Model ID' },
                  {
                    dataIndex: 'type',
                    key: 'type',
                    title: 'Generation Type',
                    render: (type: OpenRouterModelRow['type']) => (
                      <Tag color={type === 'video' ? 'purple' : 'cyan'}>{type.toUpperCase()}</Tag>
                    ),
                  },
                  {
                    key: 'available',
                    title: 'Available to Users',
                    render: (_: unknown, record: OpenRouterModelRow) => (
                      <Space>
                        <Switch
                          checked={isModelAvailable(record.type, record.id)}
                          onChange={(checked) =>
                            setModelAvailability(record.type, record.id, checked)
                          }
                        />
                        <Button
                          size="small"
                          onClick={() => mutate('admin:providers:openrouter-generation-models')}
                        >
                          Refresh
                        </Button>
                      </Space>
                    ),
                  },
                  { dataIndex: 'description', key: 'description', title: 'Description' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default AdminProvidersPage;

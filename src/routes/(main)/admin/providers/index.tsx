'use client';

import {
  Avatar,
  Button,
  Form,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import AdminLabel, { adminIcons } from '@/routes/(main)/admin/components/AdminLabel';

// ─── Types ────────────────────────────────────────────────────────────────────

type GlobalProvider = {
  description?: string | null;
  enabled: boolean;
  id: string;
  logo?: string | null;
  name: string;
  originalName: string;
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

// ─── Global Provider Management Tab ──────────────────────────────────────────

const GlobalProvidersTab = () => {
  const { mutate } = useSWRConfig();
  const [editingProvider, setEditingProvider] = useState<GlobalProvider | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useSWR('admin:global-providers', async () => {
    const result = await lambdaClient.admin.getGlobalProviderSettings.query();
    return (result.data?.providers || []) as GlobalProvider[];
  });

  const openEdit = (provider: GlobalProvider) => {
    setEditingProvider(provider);
    form.setFieldsValue({
      customLabel: provider.name !== provider.originalName ? provider.name : '',
      customLogo: provider.logo || '',
      enabled: provider.enabled,
    });
  };

  const quickToggle = async (provider: GlobalProvider) => {
    setSavingId(provider.id);
    try {
      await lambdaClient.admin.upsertGlobalProviderSetting.mutate({
        customLabel: provider.name !== provider.originalName ? provider.name : undefined,
        customLogo: provider.logo || undefined,
        enabled: !provider.enabled,
        providerId: provider.id,
      });
      message.success(
        `${provider.originalName} ${!provider.enabled ? 'enabled' : 'disabled'} for all users`,
      );
      mutate('admin:global-providers');
    } catch {
      message.error('Failed to update provider');
    } finally {
      setSavingId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingProvider) return;
    try {
      const values = await form.validateFields();
      await lambdaClient.admin.upsertGlobalProviderSetting.mutate({
        customLabel: values.customLabel || undefined,
        customLogo: values.customLogo || undefined,
        enabled: values.enabled,
        providerId: editingProvider.id,
      });
      message.success(`${editingProvider.originalName} settings saved`);
      setEditingProvider(null);
      form.resetFields();
      mutate('admin:global-providers');
    } catch {
      message.error('Failed to save settings');
    }
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <>
      <p>
        Toggle providers on/off globally — disabled providers are completely hidden from all users
        everywhere in the application. Customize display name and logo icon per provider.
      </p>

      <Table
        dataSource={data || []}
        rowKey="id"
        scroll={{ y: 600 }}
        columns={[
          {
            key: 'provider',
            title: <AdminLabel icon={adminIcons.providers}>Provider</AdminLabel>,
            width: 260,
            render: (_: unknown, record: GlobalProvider) => (
              <Space>
                {record.logo ? (
                  <Avatar size={28} src={record.logo} style={{ flexShrink: 0 }} />
                ) : (
                  <Avatar size={28} style={{ background: '#4f46e5', flexShrink: 0 }}>
                    {record.id.slice(0, 2).toUpperCase()}
                  </Avatar>
                )}
                <span>{record.name}</span>
                {record.name !== record.originalName && (
                  <Tag color="blue" style={{ marginLeft: 4 }}>
                    Renamed
                  </Tag>
                )}
              </Space>
            ),
          },
          {
            dataIndex: 'id',
            key: 'id',
            title: <AdminLabel icon={adminIcons.key}>Provider ID</AdminLabel>,
            width: 180,
            render: (id: string) => <code>{id}</code>,
          },
          {
            dataIndex: 'originalName',
            key: 'originalName',
            title: <AdminLabel icon={adminIcons.email}>Original Name</AdminLabel>,
            width: 160,
          },
          {
            dataIndex: 'enabled',
            key: 'enabled',
            title: <AdminLabel icon={adminIcons.featureFlags}>Global Status</AdminLabel>,
            width: 140,
            render: (enabled: boolean, record: GlobalProvider) => (
              <Tooltip
                title={enabled ? 'Click to disable for all users' : 'Click to enable for all users'}
              >
                <Switch
                  checked={enabled}
                  checkedChildren="ON"
                  loading={savingId === record.id}
                  unCheckedChildren="OFF"
                  onChange={() => quickToggle(record)}
                />
              </Tooltip>
            ),
          },
          {
            key: 'actions',
            title: <AdminLabel icon={adminIcons.actions}>Edit</AdminLabel>,
            width: 100,
            render: (_: unknown, record: GlobalProvider) => (
              <Button size="small" onClick={() => openEdit(record)}>
                Edit
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={!!editingProvider}
        title={
          <Space>
            {editingProvider?.logo && <Avatar size={24} src={editingProvider.logo} />}
            <AdminLabel icon={adminIcons.providers}>
              {`Edit Provider: ${editingProvider?.originalName || ''}`}
            </AdminLabel>
          </Space>
        }
        onCancel={() => {
          setEditingProvider(null);
          form.resetFields();
        }}
        onOk={saveEdit}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label={<AdminLabel icon={adminIcons.featureFlags}>Global Status</AdminLabel>}
            name="enabled"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Enabled for users"
              unCheckedChildren="Disabled for all users"
            />
          </Form.Item>
          <Form.Item
            extra={`Leave blank to use the original name: "${editingProvider?.originalName}"`}
            label={<AdminLabel icon={adminIcons.email}>Custom Display Name</AdminLabel>}
            name="customLabel"
          >
            <Input placeholder={editingProvider?.originalName} />
          </Form.Item>
          <Form.Item
            extra="Paste an image URL (https://...) to override the default provider icon"
            label={<AdminLabel icon={adminIcons.value}>Custom Logo URL</AdminLabel>}
            name="customLogo"
          >
            <Input placeholder="https://example.com/logo.png" />
          </Form.Item>
          {form.getFieldValue('customLogo') && (
            <Avatar size={48} src={form.getFieldValue('customLogo')} style={{ marginBottom: 12 }} />
          )}
        </Form>
      </Modal>
    </>
  );
};

// ─── OpenRouter Generation Models Tab ────────────────────────────────────────

const OpenRouterModelsTab = () => {
  const { mutate } = useSWRConfig();

  const { data: policies } = useSWR('admin:providers:policies', async () => {
    const result = await lambdaClient.admin.getProviderOverview.query();
    return ((result.data as any)?.policies || []) as GovernancePolicy[];
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
    const existing = policies?.find(
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
      message.success('Model availability updated');
      mutate('admin:providers:policies');
    } catch {
      message.error('Update failed');
    }
  };

  const isModelAvailable = (domain: 'image' | 'video', modelId: string) => {
    const target = `provider:openrouter:model:${modelId}`;
    return !policies?.some(
      (p) => p.domain === domain && p.target === target && p.mode === 'deny' && p.isActive,
    );
  };

  return (
    <Table
      dataSource={openRouterModels || []}
      loading={isModelLoading}
      rowKey={(row) => `${row.type}:${row.id}`}
      columns={[
        {
          dataIndex: 'name',
          key: 'name',
          title: <AdminLabel icon={adminIcons.plan}>Model</AdminLabel>,
        },
        {
          dataIndex: 'id',
          key: 'id',
          title: <AdminLabel icon={adminIcons.key}>Model ID</AdminLabel>,
        },
        {
          dataIndex: 'type',
          key: 'type',
          title: <AdminLabel icon={adminIcons.featureFlags}>Generation Type</AdminLabel>,
          render: (type: OpenRouterModelRow['type']) => (
            <Tag color={type === 'video' ? 'purple' : 'cyan'}>{type.toUpperCase()}</Tag>
          ),
        },
        {
          key: 'available',
          title: <AdminLabel icon={adminIcons.featureFlags}>Available to Users</AdminLabel>,
          render: (_: unknown, record: OpenRouterModelRow) => (
            <Switch
              checked={isModelAvailable(record.type, record.id)}
              onChange={(checked) => setModelAvailability(record.type, record.id, checked)}
            />
          ),
        },
        {
          dataIndex: 'description',
          key: 'description',
          title: <AdminLabel icon={adminIcons.description}>Description</AdminLabel>,
        },
      ]}
    />
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AdminProvidersPage = () => (
  <div>
    <Tabs
      defaultActiveKey="global-providers"
      items={[
        {
          children: <GlobalProvidersTab />,
          key: 'global-providers',
          label: (
            <AdminLabel icon={adminIcons.providers}>Global Provider Control</AdminLabel>
          ),
        },
        {
          children: <OpenRouterModelsTab />,
          key: 'openrouter-models',
          label: (
            <AdminLabel icon={adminIcons.plan}>OpenRouter Generation Models</AdminLabel>
          ),
        },
      ]}
    />
  </div>
);

export default AdminProvidersPage;

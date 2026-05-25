'use client';

import { Button, Input, message, Modal, Popconfirm, Select, Space, Spin, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

type AdminUserRow = {
  banned: boolean;
  email?: string | null;
  featureOverrides?: Array<{ enabled: boolean; flagKey: string }>;
  id: string;
  planKey: string;
  role?: string | null;
};

const AdminUsers = () => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [banReason, setBanReason] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: userData, isLoading } = useSWR(
    'admin:users',
    async () => {
      const result = await lambdaClient.admin.getUsers.query({ limit: 100 });
      return result.data;
    },
    { revalidateOnFocus: false },
  );

  const { data: planData } = useSWR('admin:users:plans', async () => {
    const result = await lambdaClient.admin.getPlans.query();
    return result.data || { plans: [] };
  });

  const { data: flagData } = useSWR('admin:users:feature-flags', async () => {
    const result = await lambdaClient.admin.getFeatureFlags.query();
    return result.data || [];
  });

  const planOptions = useMemo(
    () =>
      (planData?.plans || []).map((plan: { key: string; label: string }) => ({
        label: plan.label,
        value: plan.key,
      })),
    [planData?.plans],
  );

  const flagOptions = useMemo(
    () =>
      (flagData || []).map((flag: { key: string; label: string }) => ({
        label: flag.label,
        value: flag.key,
      })),
    [flagData],
  );

  const updateRole = async (userId: string, role: string) => {
    try {
      await lambdaClient.admin.updateUserRole.mutate({ role, userId });
      message.success('Role updated');
      mutate('admin:users');
    } catch {
      message.error('Role update failed');
    }
  };

  const updatePlan = async (userId: string, planKey: string) => {
    try {
      await lambdaClient.admin.assignUserPlan.mutate({ planKey, userId });
      message.success('Plan updated');
      mutate('admin:users');
      mutate('admin:plans');
    } catch {
      message.error('Plan update failed');
    }
  };

  const updateFeatureOverride = async (userId: string, flagKey: string, enabled: boolean) => {
    try {
      await lambdaClient.admin.setUserFeatureFlag.mutate({ enabled, flagKey, userId });
      message.success('Feature override updated');
      mutate('admin:users');
    } catch {
      message.error('Feature override failed');
    }
  };

  const handleBanUser = async (userId: string) => {
    try {
      await lambdaClient.admin.banUser.mutate({
        reason: banReason,
        userId,
      });
      message.success(t('userBanned', { ns: 'admin' }));
      setBanReason('');
      setSelectedUserId(null);
      mutate('admin:users');
    } catch {
      message.error(t('banFailed', { ns: 'admin' }));
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await lambdaClient.admin.unbanUser.mutate({ userId });
      message.success(t('userUnbanned', { ns: 'admin' }));
      mutate('admin:users');
    } catch {
      message.error(t('unbanFailed', { ns: 'admin' }));
    }
  };

  if (isLoading) {
    return <Spin size="large" style={{ marginTop: '48px' }} />;
  }

  const columns = [
    {
      dataIndex: 'email',
      key: 'email',
      title: t('email', { ns: 'admin' }),
    },
    {
      dataIndex: 'banned',
      key: 'banned',
      render: (banned: boolean) => (banned ? t('yes', { ns: 'admin' }) : t('no', { ns: 'admin' })),
      title: t('banned', { ns: 'admin' }),
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (role: string | null, record: AdminUserRow) => (
        <Select
          style={{ width: 140 }}
          value={role || 'user'}
          options={[
            { label: 'User', value: 'user' },
            { label: 'Moderator', value: 'moderator' },
            { label: 'Admin', value: 'admin' },
          ]}
          onChange={(value) => updateRole(record.id, value)}
        />
      ),
      title: 'Role',
    },
    {
      dataIndex: 'planKey',
      key: 'planKey',
      render: (planKey: string, record: AdminUserRow) => (
        <Select
          options={planOptions}
          style={{ width: 160 }}
          value={planKey || 'starter'}
          onChange={(value) => updatePlan(record.id, value)}
        />
      ),
      title: 'Plan',
    },
    {
      key: 'featureOverrides',
      render: (_: unknown, record: AdminUserRow) => (
        <Space direction="vertical" size={4}>
          <Select
            showSearch
            options={flagOptions}
            placeholder="Enable feature"
            style={{ width: 220 }}
            onChange={(flagKey) => updateFeatureOverride(record.id, flagKey, true)}
          />
          <Select
            showSearch
            options={flagOptions}
            placeholder="Disable feature"
            style={{ width: 220 }}
            onChange={(flagKey) => updateFeatureOverride(record.id, flagKey, false)}
          />
          <Space wrap>
            {(record.featureOverrides || []).map((override) => (
              <Tag color={override.enabled ? 'green' : 'red'} key={override.flagKey}>
                {override.flagKey}: {override.enabled ? 'On' : 'Off'}
              </Tag>
            ))}
          </Space>
        </Space>
      ),
      title: 'Feature Overrides',
    },
    {
      key: 'actions',
      render: (_: unknown, record: AdminUserRow) => (
        <Space>
          {!record.banned ? (
            <Button danger size="small" onClick={() => setSelectedUserId(record.id)}>
              {t('ban', { ns: 'admin' })}
            </Button>
          ) : (
            <Popconfirm
              cancelText={t('no', { ns: 'admin' })}
              description={t('unbanConfirm', { ns: 'admin' })}
              okText={t('yes', { ns: 'admin' })}
              title={t('confirm', { ns: 'admin' })}
              onConfirm={() => handleUnbanUser(record.id)}
            >
              <Button size="small">{t('unban', { ns: 'admin' })}</Button>
            </Popconfirm>
          )}
        </Space>
      ),
      title: t('actions', { ns: 'admin' }),
    },
  ];

  return (
    <div>
      <h2>{t('users', { ns: 'admin' })}</h2>
      <Table
        columns={columns}
        dataSource={userData?.users || []}
        rowKey="id"
        pagination={{
          pageSize: 20,
          total: userData?.total,
        }}
      />

      <Modal
        open={!!selectedUserId}
        title={t('banUser', { ns: 'admin' })}
        onOk={() => selectedUserId && handleBanUser(selectedUserId)}
        onCancel={() => {
          setSelectedUserId(null);
          setBanReason('');
        }}
      >
        <Input.TextArea
          placeholder={t('banReasonPlaceholder', { ns: 'admin' })}
          rows={4}
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default AdminUsers;

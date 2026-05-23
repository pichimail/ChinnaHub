'use client';

import { Button, message, Select, Space, Spin, Table } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const roleOptions = [
  { label: 'user', value: 'user' },
  { label: 'admin', value: 'admin' },
  { label: 'moderator', value: 'moderator' },
];

const AdminRolesPage = () => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const { data: userData, isLoading } = useSWR('admin:roles:users', async () => {
    const result = await lambdaClient.admin.getUsers.query({ limit: 200, offset: 0 });
    return result.data;
  });

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      setSavingUserId(userId);
      await lambdaClient.admin.updateUserRole.mutate({ role, userId });
      message.success('Role updated');
      mutate('admin:roles:users');
    } catch {
      message.error('Failed to update role');
    } finally {
      setSavingUserId(null);
    }
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <h2>{t('roleManagement', { ns: 'admin' })}</h2>
      <Table
        dataSource={userData?.users || []}
        pagination={{ pageSize: 20 }}
        rowKey="id"
        columns={[
          { dataIndex: 'email', key: 'email', title: t('email', { ns: 'admin' }) },
          {
            dataIndex: 'role',
            key: 'role',
            title: t('roleManagement', { ns: 'admin' }),
            render: (role: string, record: any) => (
              <Space>
                <Select
                  options={roleOptions}
                  style={{ minWidth: 140 }}
                  value={role || 'user'}
                  onChange={(nextRole) => handleRoleChange(record.id, nextRole)}
                />
                {savingUserId === record.id ? <Spin size="small" /> : null}
              </Space>
            ),
          },
          {
            dataIndex: 'id',
            key: 'id',
            title: 'ID',
            render: (id: string) => id?.slice(0, 8),
          },
        ]}
      />

      <div style={{ marginTop: 12 }}>
        <Button onClick={() => mutate('admin:roles:users')}>Refresh</Button>
      </div>
    </div>
  );
};

export default AdminRolesPage;

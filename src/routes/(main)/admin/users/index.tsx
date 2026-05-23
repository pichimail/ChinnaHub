'use client';

import { Button, Input, message, Modal, Popconfirm, Space, Spin, Table } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

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
      key: 'actions',
      render: (_: unknown, record: any) => (
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

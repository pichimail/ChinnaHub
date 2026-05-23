'use client';

import { Spin, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const AdminAuditLogs = () => {
  const { t } = useTranslation();

  const { data: logsData, isLoading } = useQuery(
    'admin:audit-logs',
    async () => {
      const result = await lambdaClient.admin.getAuditLogs.query({ limit: 100 });
      return result.data || [];
    },
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return <Spin size="large" style={{ marginTop: '48px' }} />;
  }

  const columns = [
    {
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
      title: t('admin.timestamp', { ns: 'admin' }),
    },
    {
      dataIndex: 'adminEmail',
      key: 'adminEmail',
      title: t('admin.admin', { ns: 'admin' }),
    },
    {
      dataIndex: 'action',
      key: 'action',
      title: t('admin.action', { ns: 'admin' }),
    },
    {
      dataIndex: 'targetType',
      key: 'targetType',
      title: t('admin.targetType', { ns: 'admin' }),
    },
    {
      dataIndex: 'targetId',
      key: 'targetId',
      title: t('admin.targetId', { ns: 'admin' }),
      render: (id: string) => (
        <span style={{ fontSize: '12px', color: 'var(--colorTextSecondary)' }}>
          {id?.slice(0, 8)}...
        </span>
      ),
    },
  ];

  return (
    <div>
      <h2>{t('admin.auditLogs', { ns: 'admin' })}</h2>
      <Table
        columns={columns}
        dataSource={logsData || []}
        rowKey="id"
        pagination={{
          pageSize: 20,
        }}
      />
    </div>
  );
};

export default AdminAuditLogs;

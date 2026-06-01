'use client';

import { Spin, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import AdminLabel, { adminIcons } from '@/routes/(main)/admin/components/AdminLabel';

const AdminAuditLogs = () => {
  const { t } = useTranslation();

  const { data: logsData, isLoading } = useSWR(
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
      title: <AdminLabel icon={adminIcons.updated}>{t('timestamp', { ns: 'admin' })}</AdminLabel>,
    },
    {
      dataIndex: 'adminEmail',
      key: 'adminEmail',
      title: <AdminLabel icon={adminIcons.email}>{t('admin', { ns: 'admin' })}</AdminLabel>,
    },
    {
      dataIndex: 'action',
      key: 'action',
      title: <AdminLabel icon={adminIcons.actions}>{t('action', { ns: 'admin' })}</AdminLabel>,
    },
    {
      dataIndex: 'targetType',
      key: 'targetType',
      title: <AdminLabel icon={adminIcons.target}>Target Type</AdminLabel>,
    },
    {
      dataIndex: 'targetId',
      key: 'targetId',
      title: <AdminLabel icon={adminIcons.key}>{t('targetId', { ns: 'admin' })}</AdminLabel>,
      render: (id: string) => (
        <span style={{ fontSize: '12px', color: 'var(--colorTextSecondary)' }}>
          {id?.slice(0, 8)}...
        </span>
      ),
    },
  ];

  return (
    <div>
      <h2>
        <AdminLabel icon={adminIcons.auditLogs}>{t('auditLogs', { ns: 'admin' })}</AdminLabel>
      </h2>
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

'use client';

import { Badge, Spin, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const AdminProvidersPage = () => {
  const { t } = useTranslation();

  const { data, isLoading } = useSWR('admin:providers', async () => {
    const result = await lambdaClient.admin.getProviderOverview.query();
    return result.data || [];
  });

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <h2>{t('admin.providerManagement', { ns: 'admin' })}</h2>
      <Table
        dataSource={data}
        rowKey={(row) => `${row.id}:${row.userId}`}
        columns={[
          { dataIndex: 'id', key: 'id', title: 'Provider ID' },
          { dataIndex: 'name', key: 'name', title: t('admin.label', { ns: 'admin' }) },
          {
            dataIndex: 'enabled',
            key: 'enabled',
            title: 'Enabled',
            render: (enabled: boolean) =>
              enabled ? (
                <Badge status="success" text={t('admin.yes', { ns: 'admin' })} />
              ) : (
                <Badge status="default" text={t('admin.no', { ns: 'admin' })} />
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
    </div>
  );
};

export default AdminProvidersPage;

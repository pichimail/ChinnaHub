'use client';

import { Card, Col, Row, Spin, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const AdminOverview = () => {
  const { t } = useTranslation();
  const { data: statsData, isLoading } = useQuery(
    'admin:system-stats',
    async () => {
      const result = await lambdaClient.admin.getSystemStats.query();
      return result.data;
    },
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return <Spin size="large" style={{ marginTop: '48px' }} />;
  }

  return (
    <div>
      <h2>{t('admin.systemStatistics', { ns: 'admin' })}</h2>
      <Row gutter={16}>
        <Col md={6} sm={12} xs={24}>
          <Card>
            <Statistic
              title={t('admin.totalUsers', { ns: 'admin' })}
              value={statsData?.totalUserCount || 0}
            />
          </Card>
        </Col>
        <Col md={6} sm={12} xs={24}>
          <Card>
            <Statistic
              title={t('admin.bannedUsers', { ns: 'admin' })}
              value={statsData?.bannedUserCount || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminOverview;

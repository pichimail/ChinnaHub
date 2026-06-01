'use client';

import { Card, Col, Row, Spin, Statistic } from 'antd';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import AdminLabel, { adminIcons } from '@/routes/(main)/admin/components/AdminLabel';

const AdminOverview = () => {
  const { t } = useTranslation();
  const { data: statsData, isLoading } = useSWR(
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
      <h2>
        <AdminLabel icon={adminIcons.systemStatistics}>
          {t('systemStatistics', { ns: 'admin' })}
        </AdminLabel>
      </h2>
      <Row gutter={16}>
        <Col md={6} sm={12} xs={24}>
          <Card>
            <Statistic
              title={<AdminLabel icon={adminIcons.totalUsers}>{t('totalUsers', { ns: 'admin' })}</AdminLabel>}
              value={statsData?.totalUserCount || 0}
            />
          </Card>
        </Col>
        <Col md={6} sm={12} xs={24}>
          <Card>
            <Statistic
              title={<AdminLabel icon={adminIcons.bannedUsers}>{t('bannedUsers', { ns: 'admin' })}</AdminLabel>}
              value={statsData?.bannedUserCount || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col md={6} sm={12} xs={24}>
          <Card>
            <Statistic
              title={<AdminLabel icon={adminIcons.envVars}>{t('envVars', { ns: 'admin' })}</AdminLabel>}
              value={statsData?.envVarCount || 0}
            />
          </Card>
        </Col>
        <Col md={6} sm={12} xs={24}>
          <Card>
            <Statistic
              title={
                <AdminLabel icon={adminIcons.governance}>
                  {t('governancePolicies', { ns: 'admin' })}
                </AdminLabel>
              }
              value={statsData?.activeGovernancePolicyCount || 0}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminOverview;

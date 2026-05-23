'use client';

import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUserStore } from '@/store/user';

const AdminLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((state) => state.user);

  // Check if user is admin
  const isAdmin = user?.email === 'pichimail24@gmail.com' || user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h1>{t('admin.notAuthorized', { ns: 'admin' })}</h1>
      </div>
    );
  }

  const items = [
    { key: 'overview', label: t('admin.overview', { ns: 'admin' }), path: '/admin' },
    { key: 'users', label: t('admin.users', { ns: 'admin' }), path: '/admin/users' },
    {
      key: 'feature-flags',
      label: t('admin.featureFlags', { ns: 'admin' }),
      path: '/admin/feature-flags',
    },
    { key: 'audit-logs', label: t('admin.auditLogs', { ns: 'admin' }), path: '/admin/audit-logs' },
  ];

  const currentTab =
    items.find((item) => location.pathname.startsWith(item.path))?.key || 'overview';

  return (
    <div style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      <div
        style={{
          backgroundColor: 'white',
          padding: '16px 24px',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <h1 style={{ margin: 0 }}>{t('admin.adminConsole', { ns: 'admin' })}</h1>
      </div>

      <Tabs
        activeKey={currentTab}
        style={{ padding: '16px 24px' }}
        items={items.map((item) => ({
          key: item.key,
          label: item.label,
        }))}
        onChange={(key) => {
          const item = items.find((i) => i.key === key);
          if (item) navigate(item.path);
        }}
      />

      <div style={{ padding: '24px', backgroundColor: 'white', margin: '16px' }}>
        <p>{t('admin.selectTab', { ns: 'admin' })}</p>
      </div>
    </div>
  );
};

export default AdminLayout;

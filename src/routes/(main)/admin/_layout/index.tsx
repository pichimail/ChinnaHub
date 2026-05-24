'use client';

import { Tabs } from 'antd';
import { createStaticStyles } from 'antd-style';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useUserStore } from '@/store/user';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    overflow: auto;
    height: 100%;
    background: ${cssVar.colorBgLayout};
  `,
  panel: css`
    margin: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    background: ${cssVar.colorBgContainer};
  `,
  header: css`
    padding-block: 16px;
    padding-inline: 24px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  title: css`
    margin: 0;

    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
    color: ${cssVar.colorText};
  `,
  tabs: css`
    padding-block: 0;
    padding-inline: 12px;

    .ant-tabs-tab {
      padding-block: 14px;
      color: ${cssVar.colorTextSecondary};
      transition:
        color 0.2s ease,
        background 0.2s ease;

      &:hover {
        color: ${cssVar.colorText};
      }
    }

    .ant-tabs-tab-active .ant-tabs-tab-btn {
      color: ${cssVar.colorText} !important;
      text-shadow: none;
    }

    .ant-tabs-ink-bar {
      height: 2px;
      border-radius: 999px;
      background: ${cssVar.colorText};
    }
  `,
  content: css`
    padding: 16px;
  `,
  unauthorized: css`
    padding: 32px;
    color: ${cssVar.colorText};
    text-align: center;
  `,
}));

const AdminLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((state) => state.user);

  // Check if user is admin
  const isAdmin = user?.email === 'pichimail24@gmail.com' || user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className={styles.unauthorized}>
        <h1>{t('notAuthorized', { ns: 'admin' })}</h1>
      </div>
    );
  }

  const items = [
    { key: 'overview', label: t('overview', { ns: 'admin' }), path: '/admin' },
    { key: 'users', label: t('users', { ns: 'admin' }), path: '/admin/users' },
    { key: 'roles', label: t('roleManagement', { ns: 'admin' }), path: '/admin/roles' },
    { key: 'api-keys', label: t('apiKeys', { ns: 'admin' }), path: '/admin/api-keys' },
    {
      key: 'providers',
      label: t('providerManagement', { ns: 'admin' }),
      path: '/admin/providers',
    },
    {
      key: 'feature-flags',
      label: t('featureFlags', { ns: 'admin' }),
      path: '/admin/feature-flags',
    },
    {
      key: 'plans',
      label: t('plans', { ns: 'admin' }),
      path: '/admin/plans',
    },
    {
      key: 'env-vars',
      label: t('envVars', { ns: 'admin' }),
      path: '/admin/env-vars',
    },
    {
      key: 'governance',
      label: t('governance', { ns: 'admin' }),
      path: '/admin/governance',
    },
    { key: 'audit-logs', label: t('auditLogs', { ns: 'admin' }), path: '/admin/audit-logs' },
  ];

  const currentTab =
    [...items]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) =>
        item.path === '/admin'
          ? location.pathname === item.path
          : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
      )?.key || 'overview';

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('adminConsole', { ns: 'admin' })}</h1>
        </div>

        <Tabs
          activeKey={currentTab}
          className={styles.tabs}
          items={items.map((item) => ({
            key: item.key,
            label: item.label,
          }))}
          onChange={(key) => {
            const item = items.find((i) => i.key === key);
            if (item) navigate(item.path);
          }}
        />

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

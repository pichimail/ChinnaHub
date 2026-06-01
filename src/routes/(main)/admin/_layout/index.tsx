'use client';

import { Tabs } from 'antd';
import { createStaticStyles } from 'antd-style';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import AdminLabel, { adminIcons } from '@/routes/(main)/admin/components/AdminLabel';
import { useUserStore } from '@/store/user';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    overflow: auto;
    height: 100%;
    padding: 16px;

    background:
      radial-gradient(circle at top, rgba(255, 255, 255, 0.05), transparent 34%),
      linear-gradient(180deg, #050505 0%, #070707 100%);
  `,
  panel: css`
    overflow: hidden;

    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 18px;
    background: rgba(4, 4, 4, 0.78);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.02) inset,
      0 16px 48px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(18px);
  `,
  header: css`
    padding-block: 20px 16px;
    padding-inline: 24px;
    border-block-end: 1px solid rgba(255, 255, 255, 0.08);
  `,
  title: css`
    margin: 0;

    font-size: 28px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: #fff;
  `,
  tabs: css`
    padding-inline: 16px;
    border-block-end: 1px solid rgba(255, 255, 255, 0.08);

    :global(.ant-tabs-nav) {
      margin: 0;
    }

    :global(.ant-tabs-nav::before) {
      border-block-end-color: transparent;
    }

    :global(.ant-tabs-tab) {
      padding-block: 16px;
      margin: 0 20px 0 0;
      color: rgba(255, 255, 255, 0.58);
      transition: color 0.2s ease;

      &:hover {
        color: rgba(255, 255, 255, 0.92);
      }
    }

    :global(.ant-tabs-tab-btn) {
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.01em;
    }

    :global(.ant-tabs-tab-active .ant-tabs-tab-btn) {
      color: #fff !important;
      text-shadow: none;
    }

    :global(.ant-tabs-ink-bar) {
      height: 2px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
    }
  `,
  content: css`
    padding: 24px;
    color: rgba(255, 255, 255, 0.92);

    :global(.ant-card) {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.02);
      box-shadow: none;
      color: #fff;
    }

    :global(.ant-card-head) {
      border-block-end-color: rgba(255, 255, 255, 0.08);
      color: #fff;
    }

    :global(.ant-card-body) {
      background: transparent;
    }

    :global(.ant-input),
    :global(.ant-input-affix-wrapper),
    :global(.ant-input-number),
    :global(.ant-select-selector),
    :global(.ant-picker),
    :global(.ant-textarea-affix-wrapper) {
      border-color: rgba(255, 255, 255, 0.1) !important;
      color: #fff;
      background: rgba(255, 255, 255, 0.03) !important;
      box-shadow: none !important;
    }

    :global(.ant-input::placeholder),
    :global(.ant-select-selection-placeholder),
    :global(.ant-input-number-input::placeholder) {
      color: rgba(255, 255, 255, 0.42);
    }

    :global(.ant-input-number-input),
    :global(.ant-select-selection-item) {
      color: #fff;
    }

    :global(.ant-select-arrow),
    :global(.ant-input-suffix),
    :global(.ant-input-prefix) {
      color: rgba(255, 255, 255, 0.72);
    }

    :global(.ant-modal-content) {
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: #0b0b0b;
      color: #fff;
    }

    :global(.ant-modal-header) {
      background: transparent;
      border-block-end-color: rgba(255, 255, 255, 0.08);
    }

    :global(.ant-modal-title) {
      color: #fff;
    }

    :global(.ant-modal-close) {
      color: rgba(255, 255, 255, 0.7);
    }

    :global(.ant-table) {
      background: transparent;
      color: #fff;
    }

    :global(.ant-table-container) {
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      overflow: hidden;
    }

    :global(.ant-table-thead > tr > th) {
      border-block-end-color: rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: rgba(255, 255, 255, 0.82);
      font-weight: 600;
    }

    :global(.ant-table-tbody > tr > td) {
      border-block-end-color: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.92);
    }

    :global(.ant-table-tbody > tr:hover > td) {
      background: rgba(255, 255, 255, 0.03);
    }

    :global(.ant-tag) {
      border-color: rgba(255, 255, 255, 0.12);
    }

    :global(.ant-spin) {
      color: #fff;
    }
  `,
  unauthorized: css`
    padding: 32px;
    color: #fff;
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
    {
      key: 'overview',
      label: <AdminLabel icon={adminIcons.overview}>{t('overview', { ns: 'admin' })}</AdminLabel>,
      path: '/admin',
    },
    {
      key: 'users',
      label: <AdminLabel icon={adminIcons.users}>{t('users', { ns: 'admin' })}</AdminLabel>,
      path: '/admin/users',
    },
    {
      key: 'roles',
      label: (
        <AdminLabel icon={adminIcons.roleManagement}>
          {t('roleManagement', { ns: 'admin' })}
        </AdminLabel>
      ),
      path: '/admin/roles',
    },
    {
      key: 'api-keys',
      label: <AdminLabel icon={adminIcons.apiKeys}>{t('apiKeys', { ns: 'admin' })}</AdminLabel>,
      path: '/admin/api-keys',
    },
    {
      key: 'providers',
      label: <AdminLabel icon={adminIcons.providers}>{t('providerManagement', { ns: 'admin' })}</AdminLabel>,
      path: '/admin/providers',
    },
    {
      key: 'feature-flags',
      label: (
        <AdminLabel icon={adminIcons.featureFlags}>{t('featureFlags', { ns: 'admin' })}</AdminLabel>
      ),
      path: '/admin/feature-flags',
    },
    {
      key: 'plans',
      label: <AdminLabel icon={adminIcons.plans}>{t('plans', { ns: 'admin' })}</AdminLabel>,
      path: '/admin/plans',
    },
    {
      key: 'env-vars',
      label: <AdminLabel icon={adminIcons.envVars}>{t('envVars', { ns: 'admin' })}</AdminLabel>,
      path: '/admin/env-vars',
    },
    {
      key: 'governance',
      label: <AdminLabel icon={adminIcons.governance}>{t('governance', { ns: 'admin' })}</AdminLabel>,
      path: '/admin/governance',
    },
    {
      key: 'audit-logs',
      label: <AdminLabel icon={adminIcons.auditLogs}>{t('auditLogs', { ns: 'admin' })}</AdminLabel>,
      path: '/admin/audit-logs',
    },
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
          <h1 className={styles.title}>
            <AdminLabel icon={adminIcons.overview}>{t('adminConsole', { ns: 'admin' })}</AdminLabel>
          </h1>
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

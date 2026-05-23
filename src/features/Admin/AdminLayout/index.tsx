'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import {
  BarChart3Icon,
  FileTextIcon,
  FlagIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react';
import { type FC, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const useStyles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    display: flex;
    height: 100%;
    background: ${cssVar.colorBgLayout};
  `,
  sidebar: css`
    overflow-y: auto;
    display: flex;
    flex-direction: column;

    width: 220px;
    min-width: 220px;
    height: 100%;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  header: css`
    padding-block: 20px 12px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  headerTitle: css`
    font-size: 11px;
    font-weight: 700;
    color: ${cssVar.colorTextQuaternary};
    text-transform: uppercase;
    letter-spacing: 0.1em;
  `,
  menuItem: css`
    cursor: pointer;
    user-select: none;

    display: flex;
    gap: 10px;
    align-items: center;

    margin-block: 2px;
    margin-inline: 8px;
    padding-block: 9px;
    padding-inline: 16px;
    border-radius: 8px;

    font-size: 14px;
    color: ${cssVar.colorTextSecondary};

    transition: all 0.15s ease;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  activeMenuItem: css`
    cursor: pointer;
    user-select: none;

    display: flex;
    gap: 10px;
    align-items: center;

    margin-block: 2px;
    margin-inline: 8px;
    padding-block: 9px;
    padding-inline: 16px;
    border-radius: 8px;

    font-size: 14px;
    font-weight: 600;
    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorPrimaryBg};

    transition: all 0.15s ease;
  `,
  sectionLabel: css`
    padding-block: 16px 4px;
    padding-inline: 16px;

    font-size: 11px;
    font-weight: 700;
    color: ${cssVar.colorTextQuaternary};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  `,
  content: css`
    overflow-y: auto;
    flex: 1;

    height: 100%;
    padding: 24px;

    background: ${cssVar.colorBgLayout};
  `,
}));

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboardIcon, label: 'Dashboard', path: '/admin' },
      { icon: BarChart3Icon, label: 'Statistics', path: '/admin/stats' },
    ],
  },
  {
    label: 'User Management',
    items: [
      { icon: UsersIcon, label: 'Users', path: '/admin/users' },
      { icon: FlagIcon, label: 'Feature Flags', path: '/admin/feature-flags' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: KeyRoundIcon, label: 'API Keys', path: '/admin/api-keys' },
      { icon: ScrollTextIcon, label: 'Audit Log', path: '/admin/audit-log' },
      { icon: FileTextIcon, label: 'Content', path: '/admin/content' },
    ],
  },
];

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: FC<AdminLayoutProps> = ({ children }) => {
  const { styles } = useStyles();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <Flexbox horizontal align="center" gap={8}>
            <Icon icon={ShieldIcon} size={16} />
            <span className={styles.headerTitle}>Admin Console</span>
          </Flexbox>
        </div>
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <div className={styles.sectionLabel}>{label}</div>
            {items.map(({ icon, label: itemLabel, path }) => (
              <div
                className={pathname === path ? styles.activeMenuItem : styles.menuItem}
                key={path}
                onClick={() => navigate(path)}
              >
                <Icon icon={icon} size={15} />
                {itemLabel}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default AdminLayout;

'use client';

import { createStaticStyles } from 'antd-style';
import { memo, type ReactNode } from 'react';
import {
  BadgeDollarSign,
  Ban,
  BarChart3,
  Boxes,
  Bot,
  Clock3,
  FileText,
  Globe,
  History,
  KeyRound,
  LayoutGrid,
  Mail,
  Plug,
  Scale,
  Shield,
  SlidersHorizontal,
  ToggleLeft,
  type LucideIcon,
  UsersRound,
} from 'lucide-react';

const styles = createStaticStyles(({ css }) => ({
  root: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    white-space: nowrap;
    line-height: 1;
  `,
  icon: css`
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    color: rgba(255, 255, 255, 0.58);
    stroke-width: 1.9;
  `,
  text: css`
    min-width: 0;
  `,
}));

export const adminIcons = {
  actions: SlidersHorizontal,
  assistant: Bot,
  apiKeys: KeyRound,
  auditLogs: History,
  bannedUsers: Ban,
  description: FileText,
  domain: Globe,
  email: Mail,
  envVars: FileText,
  featureFlags: ToggleLeft,
  featureOverrides: SlidersHorizontal,
  governance: Scale,
  key: KeyRound,
  overview: LayoutGrid,
  plan: BadgeDollarSign,
  plans: BadgeDollarSign,
  providers: Plug,
  roleManagement: Shield,
  roles: Shield,
  service: Plug,
  source: FileText,
  status: BarChart3,
  systemStatistics: BarChart3,
  target: Boxes,
  updated: Clock3,
  usedFor: Boxes,
  users: UsersRound,
  value: FileText,
  values: FileText,
} as const satisfies Record<string, LucideIcon>;

export interface AdminLabelProps {
  children: ReactNode;
  icon?: LucideIcon;
}

const AdminLabel = memo<AdminLabelProps>(({ children, icon: Icon }) => (
  <span className={styles.root}>
    {Icon ? <Icon className={styles.icon} /> : null}
    <span className={styles.text}>{children}</span>
  </span>
));

export default AdminLabel;

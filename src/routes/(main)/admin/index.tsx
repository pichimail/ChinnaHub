'use client';

import { ActionIcon, Block, Button, Flexbox, Input, Text } from '@lobehub/ui';
import { App, Card, Divider, Modal, Switch, Table } from 'antd';
import { KeyRound, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import NavHeader from '@/features/NavHeader';
import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';

const ADMIN_EMAIL = 'pichimail24@gmail.com';

const AdminPage = memo(() => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const email = useUserStore(userProfileSelectors.email);
  const isAdmin = (email || '').toLowerCase() === ADMIN_EMAIL;

  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [newFlag, setNewFlag] = useState({ key: '', name: '' });
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [rawApiKey, setRawApiKey] = useState<string | null>(null);
  const [flagAssign, setFlagAssign] = useState({ enabled: true, flagKey: '', userId: '' });
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    contentType: '',
    createdBy: '',
    endAt: '',
    startAt: '',
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, f, k, c, a] = await Promise.all([
        lambdaClient.admin.stats.query(),
        lambdaClient.admin.listUsers.query({ keyword, limit: 100 }),
        lambdaClient.admin.listFeatureFlags.query(),
        lambdaClient.admin.listApiKeys.query(),
        lambdaClient.admin.listContent.query({ limit: 20 }),
        lambdaClient.admin.listAuditLogs.query({
          action: auditFilters.action || undefined,
          contentType: auditFilters.contentType || undefined,
          createdBy: auditFilters.createdBy || undefined,
          endAt: auditFilters.endAt || undefined,
          limit: 300,
          startAt: auditFilters.startAt || undefined,
        }),
      ]);
      setStats(s);
      setUsers(u);
      setFlags(f);
      setKeys(k);
      setContent(c);
      setAuditLogs(a);
      setRoleDrafts(Object.fromEntries(u.map((user: any) => [user.id, user.role || ''])));
    } catch (e: any) {
      message.error(e?.message || 'Failed to load admin console');
    } finally {
      setLoading(false);
    }
  }, [
    auditFilters.action,
    auditFilters.contentType,
    auditFilters.createdBy,
    auditFilters.endAt,
    auditFilters.startAt,
    keyword,
    message,
  ]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadAll();
  }, [isAdmin, loadAll, navigate]);

  const statCards = useMemo(
    () => [
      { key: 'users', title: 'Users', value: stats?.users ?? 0 },
      { key: 'messages', title: 'Messages', value: stats?.messages ?? 0 },
      { key: 'topics', title: 'Topics', value: stats?.topics ?? 0 },
      { key: 'featureFlags', title: 'Feature Flags', value: stats?.featureFlags ?? 0 },
      { key: 'activeApiKeys', title: 'Active API Keys', value: stats?.activeApiKeys ?? 0 },
    ],
    [stats],
  );

  if (!isAdmin) return null;

  const exportAuditLogsCsv = () => {
    const headers = [
      'createdAt',
      'createdBy',
      'contentType',
      'contentId',
      'action',
      'reason',
      'metadata',
    ];
    const rows = auditLogs.map((log) =>
      [
        log.createdAt ? new Date(log.createdAt).toISOString() : '',
        log.createdBy || '',
        log.contentType || '',
        log.contentId || '',
        log.action || '',
        (log.reason || '').replaceAll('"', '""'),
        JSON.stringify(log.metadata || {}).replaceAll('"', '""'),
      ]
        .map((cell) => `"${cell}"`)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-audit-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <NavHeader right={<ActionIcon icon={RefreshCw} loading={loading} onClick={loadAll} />} />
      <Flexbox gap={16} padding={16}>
        <Flexbox horizontal gap={12} wrap={'wrap'}>
          {statCards.map((item) => (
            <Card key={item.key} size="small" style={{ minWidth: 180 }}>
              <Text type={'secondary'}>{item.title}</Text>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{item.value}</div>
            </Card>
          ))}
        </Flexbox>

        <Block variant={'outlined'}>
          <Flexbox horizontal align={'center'} justify={'space-between'}>
            <Text size={'large'} weight={700}>
              API Keys Management
            </Text>
            <Flexbox horizontal gap={8}>
              <Input
                placeholder="Key name"
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
              />
              <Button
                icon={<KeyRound size={16} />}
                onClick={async () => {
                  if (!newApiKeyName.trim()) return;
                  const created = await lambdaClient.admin.createApiKey.mutate({
                    name: newApiKeyName.trim(),
                    scopes: [],
                  });
                  setRawApiKey(created.rawKey);
                  setNewApiKeyName('');
                  await loadAll();
                }}
              >
                Create
              </Button>
            </Flexbox>
          </Flexbox>
          <Divider />
          <Table
            dataSource={keys}
            pagination={false}
            rowKey="id"
            columns={[
              { dataIndex: 'name', title: 'Name' },
              { dataIndex: 'keyPrefix', title: 'Prefix' },
              {
                dataIndex: 'isActive',
                title: 'Active',
                render: (v) => <Switch disabled checked={v} />,
              },
              {
                key: 'actions',
                title: 'Actions',
                render: (_, row: any) => (
                  <Button
                    danger
                    disabled={!row.isActive}
                    size="small"
                    onClick={async () => {
                      await lambdaClient.admin.revokeApiKey.mutate({ id: row.id });
                      await loadAll();
                    }}
                  >
                    Revoke
                  </Button>
                ),
              },
            ]}
          />
        </Block>

        <Block variant={'outlined'}>
          <Flexbox horizontal align={'center'} justify={'space-between'}>
            <Text size={'large'} weight={700}>
              Feature Flags Per User
            </Text>
            <Flexbox horizontal gap={8}>
              <Input
                placeholder="Flag key"
                value={newFlag.key}
                onChange={(e) => setNewFlag((p) => ({ ...p, key: e.target.value }))}
              />
              <Input
                placeholder="Flag name"
                value={newFlag.name}
                onChange={(e) => setNewFlag((p) => ({ ...p, name: e.target.value }))}
              />
              <Button
                onClick={async () => {
                  if (!newFlag.key.trim() || !newFlag.name.trim()) return;
                  await lambdaClient.admin.upsertFeatureFlag.mutate({
                    description: '',
                    enabledByDefault: false,
                    key: newFlag.key.trim(),
                    name: newFlag.name.trim(),
                  });
                  setNewFlag({ key: '', name: '' });
                  await loadAll();
                }}
              >
                Add Flag
              </Button>
              <Input
                placeholder="Target user ID"
                value={flagAssign.userId}
                onChange={(e) => setFlagAssign((p) => ({ ...p, userId: e.target.value }))}
              />
              <Input
                placeholder="Assign flag key"
                value={flagAssign.flagKey}
                onChange={(e) => setFlagAssign((p) => ({ ...p, flagKey: e.target.value }))}
              />
              <Switch
                checked={flagAssign.enabled}
                checkedChildren="ON"
                unCheckedChildren="OFF"
                onChange={(enabled) => setFlagAssign((p) => ({ ...p, enabled }))}
              />
              <Button
                onClick={async () => {
                  if (!flagAssign.userId.trim() || !flagAssign.flagKey.trim()) return;
                  await lambdaClient.admin.setFlagForUser.mutate({
                    enabled: flagAssign.enabled,
                    flagKey: flagAssign.flagKey.trim(),
                    userId: flagAssign.userId.trim(),
                  });
                  message.success('User flag updated');
                }}
              >
                Assign User Flag
              </Button>
            </Flexbox>
          </Flexbox>
          <Divider />
          <Table
            dataSource={flags}
            pagination={false}
            rowKey="key"
            columns={[
              { dataIndex: 'key', title: 'Key' },
              { dataIndex: 'name', title: 'Name' },
              {
                dataIndex: 'enabledByDefault',
                title: 'Default Enabled',
                render: (v) => <Switch disabled checked={v} />,
              },
            ]}
          />
        </Block>

        <Block variant={'outlined'}>
          <Text size={'large'} weight={700}>
            Users
          </Text>
          <Divider />
          <Flexbox horizontal gap={8}>
            <Input
              placeholder="Search users by email/username"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Button onClick={loadAll}>Search</Button>
          </Flexbox>
          <Divider />
          <Table
            dataSource={users}
            pagination={{ pageSize: 20 }}
            rowKey="id"
            columns={[
              { dataIndex: 'email', title: 'Email' },
              { dataIndex: 'username', title: 'Username' },
              { dataIndex: 'fullName', title: 'Name' },
              { dataIndex: 'role', title: 'Role' },
              {
                dataIndex: 'banned',
                title: 'Banned',
                render: (v) => <Switch disabled checked={v} />,
              },
              {
                key: 'rowActions',
                title: 'Row Actions',
                render: (_, row: any) => (
                  <Flexbox horizontal gap={6}>
                    <Input
                      placeholder="role"
                      value={roleDrafts[row.id] || ''}
                      onChange={(e) =>
                        setRoleDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                    <Button
                      size="small"
                      onClick={async () => {
                        await lambdaClient.admin.updateUserRole.mutate({
                          role: (roleDrafts[row.id] || '').trim() || null,
                          userId: row.id,
                        });
                        message.success('Role updated');
                        await loadAll();
                      }}
                    >
                      Update Role
                    </Button>
                    {row.banned ? (
                      <Button
                        size="small"
                        onClick={async () => {
                          await lambdaClient.admin.unbanUser.mutate({ userId: row.id });
                          message.success('User unbanned');
                          await loadAll();
                        }}
                      >
                        Unban
                      </Button>
                    ) : (
                      <Button
                        danger
                        size="small"
                        onClick={async () => {
                          const reason = window.prompt('Ban reason (optional)') || '';
                          const daysInput = window.prompt('Ban duration in days (optional)') || '';
                          const days = daysInput ? Number(daysInput) : undefined;
                          await lambdaClient.admin.banUser.mutate({
                            days: Number.isFinite(days as number) ? days : undefined,
                            reason: reason || undefined,
                            userId: row.id,
                          });
                          message.success('User banned');
                          await loadAll();
                        }}
                      >
                        Ban
                      </Button>
                    )}
                  </Flexbox>
                ),
              },
            ]}
          />
        </Block>

        <Block variant={'outlined'}>
          <Text size={'large'} weight={700}>
            Content Overview
          </Text>
          <Divider />
          <Text type={'secondary'}>
            Recent messages: {content?.recentMessages?.length || 0} | Recent topics:{' '}
            {content?.recentTopics?.length || 0}
          </Text>
        </Block>

        <Block variant={'outlined'}>
          <Flexbox horizontal align={'center'} justify={'space-between'}>
            <Text size={'large'} weight={700}>
              Audit Logs
            </Text>
            <Button onClick={exportAuditLogsCsv}>Export CSV</Button>
          </Flexbox>
          <Divider />
          <Flexbox horizontal gap={8}>
            <Input
              placeholder="Action"
              value={auditFilters.action}
              onChange={(e) => setAuditFilters((p) => ({ ...p, action: e.target.value }))}
            />
            <Input
              placeholder="Content Type"
              value={auditFilters.contentType}
              onChange={(e) => setAuditFilters((p) => ({ ...p, contentType: e.target.value }))}
            />
            <Input
              placeholder="Created By User ID"
              value={auditFilters.createdBy}
              onChange={(e) => setAuditFilters((p) => ({ ...p, createdBy: e.target.value }))}
            />
            <Input
              placeholder="Start ISO Time"
              value={auditFilters.startAt}
              onChange={(e) => setAuditFilters((p) => ({ ...p, startAt: e.target.value }))}
            />
            <Input
              placeholder="End ISO Time"
              value={auditFilters.endAt}
              onChange={(e) => setAuditFilters((p) => ({ ...p, endAt: e.target.value }))}
            />
            <Button onClick={loadAll}>Apply</Button>
          </Flexbox>
          <Divider />
          <Table
            dataSource={auditLogs}
            pagination={{ pageSize: 20 }}
            rowKey="id"
            columns={[
              { dataIndex: 'createdAt', title: 'Time' },
              { dataIndex: 'action', title: 'Action' },
              { dataIndex: 'contentType', title: 'Type' },
              { dataIndex: 'contentId', title: 'Target' },
              { dataIndex: 'createdBy', title: 'Admin' },
              {
                dataIndex: 'reason',
                title: 'Reason',
                render: (v) => v || '-',
              },
            ]}
          />
        </Block>
      </Flexbox>

      <Modal
        footer={null}
        open={!!rawApiKey}
        title="New API Key"
        onCancel={() => setRawApiKey(null)}
      >
        <Text type={'secondary'}>Copy this key now. It will not be shown again.</Text>
        <Input readOnly value={rawApiKey || ''} />
      </Modal>
    </>
  );
});

AdminPage.displayName = 'AdminPage';

export default AdminPage;
